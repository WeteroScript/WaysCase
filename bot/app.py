import asyncio
import logging
import os
import sys
from collections.abc import Awaitable, Callable
from html import escape
from typing import Any
from urllib.parse import urlparse

import aiogram
from aiogram import BaseMiddleware, Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramConflictError, TelegramUnauthorizedError
from aiogram.filters import CommandStart
from aiogram.types import ErrorEvent, InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | pid=%(process)d | %(message)s",
    stream=sys.stdout,
    force=True,
)
log = logging.getLogger("wayscase")

DEFAULT_WEBAPP_URL = "https://bot-1794953284-8098-weterochina.bothost.tech/"
dp = Dispatcher()


class MessageTraceMiddleware(BaseMiddleware):
    """Log message delivery without storing users' message contents."""

    async def __call__(
        self,
        handler: Callable[[Message, dict[str, Any]], Awaitable[Any]],
        event: Message,
        data: dict[str, Any],
    ) -> Any:
        user_id = event.from_user.id if event.from_user else "unknown"
        kind = (
            f"command:{event.text.split(maxsplit=1)[0][:32]}"
            if event.text and event.text.startswith("/")
            else str(event.content_type)
        )
        log.info(
            "Message reached dispatcher: user_id=%s message_id=%s kind=%s",
            user_id,
            event.message_id,
            kind,
        )
        return await handler(event, data)


dp.message.outer_middleware(MessageTraceMiddleware())


@dp.message(CommandStart())
async def start(message: Message) -> None:
    user_id = message.from_user.id if message.from_user else "unknown"
    log.info("Handling /start: user_id=%s message_id=%s", user_id, message.message_id)

    first_name = escape(
        message.from_user.first_name
        if message.from_user and message.from_user.first_name
        else "коллекционер"
    )
    webapp_url = os.environ.get("WEBAPP_URL", DEFAULT_WEBAPP_URL).strip() or DEFAULT_WEBAPP_URL

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Открыть WaysCase",
                    web_app=WebAppInfo(url=webapp_url),
                )
            ]
        ]
    )
    await message.answer(
        f"Привет, <b>{first_name}</b>! ✨\n\n"
        "Добро пожаловать в <b>WaysCase</b> — каталог коллекционных "
        "Telegram-подарков и визуальных моделей.\n\n"
        "Нажми кнопку ниже, чтобы открыть Mini App.",
        reply_markup=keyboard,
    )
    log.info("Successfully replied to /start: user_id=%s", user_id)


@dp.message(F.text)
async def fallback(message: Message) -> None:
    await message.answer("Чтобы открыть WaysCase, отправь /start и нажми кнопку Mini App.")


@dp.errors()
async def on_update_error(event: ErrorEvent) -> bool:
    exc = event.exception
    log.error(
        "Unhandled update error: update_id=%s exception=%r",
        event.update.update_id,
        exc,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    return True


async def main() -> None:
    raw_token = os.getenv("BOT_TOKEN") or os.getenv("TELEGRAM_BOT_TOKEN") or ""
    token = raw_token.strip().strip('"').strip("'")
    token_source = "BOT_TOKEN" if os.getenv("BOT_TOKEN") else (
        "TELEGRAM_BOT_TOKEN" if os.getenv("TELEGRAM_BOT_TOKEN") else "missing"
    )

    raw_webapp_url = os.getenv("WEBAPP_URL", "").strip().strip('"').strip("'")
    parsed_url = urlparse(raw_webapp_url or DEFAULT_WEBAPP_URL)
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        log.error(
            "WEBAPP_URL is invalid; falling back to the configured default Mini App URL. "
            "Set WEBAPP_URL to a public HTTPS URL in Bothost."
        )
        webapp_url = DEFAULT_WEBAPP_URL
    else:
        webapp_url = raw_webapp_url or DEFAULT_WEBAPP_URL

    # Make the selected URL available to the /start handler.
    os.environ["WEBAPP_URL"] = webapp_url

    log.info(
        "Starting WaysCase bot: python=%s aiogram=%s token_source=%s token_present=%s "
        "webapp_host=%s log_level=%s",
        sys.version.split()[0],
        aiogram.__version__,
        token_source,
        bool(token),
        urlparse(webapp_url).netloc,
        os.getenv("LOG_LEVEL", "INFO").upper(),
    )

    if not token:
        log.critical(
            "BOT_TOKEN is missing. Add BOT_TOKEN (or TELEGRAM_BOT_TOKEN) "
            "to Bothost environment variables, then restart the container."
        )
        raise SystemExit(1)

    bot: Bot | None = None
    try:
        bot = Bot(
            token=token,
            default=DefaultBotProperties(parse_mode=ParseMode.HTML),
        )

        me = await bot.get_me()
        log.info(
            "Telegram authorization successful: username=@%s bot_id=%s",
            me.username or "unknown",
            me.id,
        )

        webhook_info = await bot.get_webhook_info()
        webhook_is_set = bool(webhook_info.url)
        log.info(
            "Telegram webhook status before polling: configured=%s pending_updates=%s",
            webhook_is_set,
            webhook_info.pending_update_count,
        )
        if webhook_is_set:
            log.warning("A webhook is configured; removing it because this deployment uses long polling.")

        await bot.delete_webhook(drop_pending_updates=False)
        log.info("Webhook removal completed; pending updates were preserved.")

        allowed_updates = dp.resolve_used_update_types()
        log.info("Starting long polling: allowed_updates=%s", allowed_updates)
        await dp.start_polling(
            bot,
            allowed_updates=allowed_updates,
        )
        log.info("Telegram polling loop stopped normally.")

    except TelegramUnauthorizedError:
        log.critical(
            "Telegram rejected the configured bot token. Replace BOT_TOKEN with the current token from BotFather."
        )
        raise
    except TelegramConflictError:
        log.exception(
            "Telegram polling conflict: another running process is already using this bot token. "
            "Stop the duplicate bot instance in Bothost or on another server."
        )
        raise
    except asyncio.CancelledError:
        log.info("WaysCase bot shutdown requested.")
        raise
    except Exception:
        log.exception("WaysCase bot stopped because of an unexpected startup or polling error.")
        raise
    finally:
        if bot is not None:
            await bot.session.close()
            log.info("Telegram bot HTTP session closed.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except SystemExit:
        raise
    except Exception:
        log.exception("Fatal WaysCase bot process error.")
        raise

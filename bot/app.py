import asyncio
import logging
import os
from html import escape
from urllib.parse import urlparse

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramConflictError, TelegramUnauthorizedError
from aiogram.filters import CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
log = logging.getLogger("wayscase")

DEFAULT_WEBAPP_URL = "https://bot-1794953284-8098-weterochina.bothost.tech/"
dp = Dispatcher()


@dp.message(CommandStart())
async def start(message: Message) -> None:
    log.info("Received /start from Telegram user id=%s", message.from_user.id if message.from_user else "unknown")
    first_name = escape(message.from_user.first_name if message.from_user and message.from_user.first_name else "коллекционер")
    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Открыть WaysCase",
                    web_app=WebAppInfo(url=os.environ.get("WEBAPP_URL", DEFAULT_WEBAPP_URL).strip()),
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


@dp.message(F.text)
async def fallback(message: Message) -> None:
    await message.answer("Чтобы открыть WaysCase, отправь /start и нажми кнопку Mini App.")


async def main() -> None:
    token = os.getenv("BOT_TOKEN", "").strip().strip('"').strip("'")
    webapp_url = os.getenv("WEBAPP_URL", DEFAULT_WEBAPP_URL).strip().strip('"').strip("'")

    if not token:
        log.critical("BOT_TOKEN is missing. Add the bot token to Bothost environment variables.")
        raise SystemExit(1)

    parsed_url = urlparse(webapp_url)
    if parsed_url.scheme != "https" or not parsed_url.netloc:
        log.critical("WEBAPP_URL must be a complete public HTTPS URL; current value is invalid.")
        raise SystemExit(1)

    # Keep the validated URL consistent for the /start handler.
    os.environ["WEBAPP_URL"] = webapp_url

    bot = Bot(
        token=token,
        default=DefaultBotProperties(parse_mode=ParseMode.HTML),
    )

    try:
        me = await bot.get_me()
        log.info("Telegram authorization successful. Bot username: @%s (id=%s)", me.username, me.id)

        # This deployment uses long polling. An old webhook prevents getUpdates from working.
        await bot.delete_webhook(drop_pending_updates=False)
        log.info("Webhook cleared; starting Telegram long polling.")

        await dp.start_polling(
            bot,
            allowed_updates=dp.resolve_used_update_types(),
        )
    except TelegramUnauthorizedError:
        log.critical("Telegram rejected BOT_TOKEN. Replace it with the current token from BotFather.")
        raise SystemExit(1)
    except TelegramConflictError:
        log.exception(
            "Telegram polling conflict. Another running instance is using this bot token; "
            "stop the duplicate instance in Bothost or elsewhere."
        )
        raise SystemExit(1)
    except asyncio.CancelledError:
        log.info("WaysCase bot shutdown requested.")
        raise
    except Exception:
        log.exception("WaysCase bot stopped because of an unexpected startup or polling error.")
        raise
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())

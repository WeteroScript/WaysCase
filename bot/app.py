import asyncio
import logging
import os
from html import escape
from urllib.parse import urlparse

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import Command, CommandStart
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO)

BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
DEFAULT_WEBAPP_URL = "https://bot-1794945234-9845-weterochina.bothost.tech/"
WEBAPP_URL = os.getenv("WEBAPP_URL", DEFAULT_WEBAPP_URL).strip() or DEFAULT_WEBAPP_URL


def validate_config() -> None:
    if not BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN is missing. Set it in the hosting environment.")
    parsed = urlparse(WEBAPP_URL)
    if parsed.scheme != "https" or not parsed.hostname:
        raise RuntimeError("WEBAPP_URL must be a valid HTTPS URL for Telegram Mini Apps.")


def menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Открыть WaysCase", web_app=WebAppInfo(url=WEBAPP_URL))
    ]])


async def send_welcome(message: Message) -> None:
    first_name = escape(message.from_user.first_name if message.from_user else "коллекционер")
    await message.answer(
        f"Привет, <b>{first_name}</b>!\n\n"
        "Добро пожаловать в <b>WaysCase</b> — каталог настоящих Telegram Gifts.\n\n"
        "Открой каталог через кнопку ниже.",
        reply_markup=menu_keyboard(),
    )


async def main() -> None:
    validate_config()
    bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dispatcher = Dispatcher()
    dispatcher.message.register(send_welcome, CommandStart())
    dispatcher.message.register(send_welcome, Command("menu"))
    try:
        await dispatcher.start_polling(bot, allowed_updates=dispatcher.resolve_used_update_types())
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())

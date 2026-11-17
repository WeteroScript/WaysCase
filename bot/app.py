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
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()


def validate_config() -> None:
    if not BOT_TOKEN:
        raise RuntimeError("BOT_TOKEN is missing. Set it in bot/.env.")
    parsed = urlparse(WEBAPP_URL)
    if parsed.scheme != "https" and parsed.hostname not in {"localhost", "127.0.0.1"}:
        raise RuntimeError("WEBAPP_URL must use HTTPS for Telegram Mini Apps.")


def menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Открыть WaysCase", web_app=WebAppInfo(url=WEBAPP_URL))
    ]])


async def send_welcome(message: Message) -> None:
    first_name = escape(message.from_user.first_name if message.from_user else "коллекционер")
    await message.answer(
        f"Привет, <b>{first_name}</b>!\n\n"
        "Добро пожаловать в <b>WaysCase</b> — пространство цифровых коллекций "
        "и Telegram NFT-подарков.\n\n"
        "Перейди в Mini App через кнопку ниже, чтобы открыть каталог, "
        "посмотреть модели и свой инвентарь.",
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

import asyncio
import logging
import os
from html import escape
from aiogram import Bot, Dispatcher
from aiogram.enums import ParseMode
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo, Message
from aiogram.client.default import DefaultBotProperties
from aiogram.filters import CommandStart

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("wayscase")
token = os.getenv("BOT_TOKEN", "").strip()
webapp_url = os.getenv("WEBAPP_URL", "").strip()
if not token:
    raise RuntimeError("BOT_TOKEN is required")
if not webapp_url.startswith("https://"):
    raise RuntimeError("WEBAPP_URL must be a public HTTPS URL")
bot = Bot(token, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp = Dispatcher()

@dp.message(CommandStart())
async def start(message: Message):
    first = escape(message.from_user.first_name or "коллекционер")
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Открыть WaysCase", web_app=WebAppInfo(url=webapp_url))
    ]])
    await message.answer(
        f"Привет, <b>{first}</b>! ✨\n\n"
        "Добро пожаловать в <b>WaysCase</b> — каталог коллекционных "
        "Telegram-подарков и визуальных моделей.\n\n"
        "Нажми кнопку ниже, чтобы открыть Mini App.",
        reply_markup=keyboard,
    )

@dp.message()
async def fallback(message: Message):
    await message.answer("Открой WaysCase через кнопку Mini App в сообщении /start.")

async def main():
    log.info("Starting WaysCase bot")
    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())

if __name__ == "__main__":
    asyncio.run(main())

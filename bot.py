from flask import Flask
from threading import Thread
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters
import json
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
import re
import gspread
import os
from google.oauth2.service_account import Credentials
import asyncio
import logging

# Set up logging
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Load Google credentials from environment variable
google_creds = json.loads(os.environ.get("GOOGLE_CREDENTIALS"))
scopes = ["https://spreadsheets.google.com/feeds", "https://www.googleapis.com/auth/drive"]
creds = Credentials.from_service_account_info(google_creds, scopes=scopes)
gc = gspread.authorize(creds)

sh = gc.open_by_key("1ERwkHzq_VvKivAzwi3vHcRl90RAz2xC70bVM6pXV1Z8")
worksheet = sh.sheet1

# Load Telegram token from environment variable
TOKEN = os.environ.get("TELEGRAM_TOKEN")
if not TOKEN:
    raise ValueError("The TELEGRAM_TOKEN environment variable is not set.")

# Load Firebase credentials from environment variable
firebase_creds_json = os.environ.get("FIREBASE_CREDENTIALS")
if not firebase_creds_json:
    raise ValueError("The FIREBASE_CREDENTIALS environment variable is not set.")

try:
    firebase_creds = json.loads(firebase_creds_json)
except json.JSONDecodeError as e:
    raise ValueError("Invalid JSON in FIREBASE_CREDENTIALS environment variable.") from e

cred = credentials.Certificate(firebase_creds)
firebase_admin.initialize_app(cred)
db = firestore.client()

# Flask app
app = Flask(__name__)

@app.route("/")
def home():
    return "Bot is running!"

# Telegram bot functions
def parse_expense(text: str) -> dict:
    """
    Extrai o valor e a categoria da mensagem do usuário.
    Args:
        text (str): Mensagem do usuário.
    Returns:
        dict: Dados da despesa no formato {'valor': float, 'categoria': str, 'data': str}.
    """
    try:
        # Extrair valor usando regex (procura por R$ seguido de números)
        valor_match = re.search(r"R\$\s*(\d+[\.,]?\d*)", text)
        if not valor_match:
            raise ValueError("Valor não encontrado na mensagem.")
        
        # Converter valor para float
        valor = float(valor_match.group(1).replace(",", "."))

        # Extrair categoria (procura por palavras após "no", "em", "com", etc.)
        categoria_match = re.search(r"(no|em|com)\s+(\w+)", text, re.IGNORECASE)
        categoria = categoria_match.group(2).lower() if categoria_match else "outros"

        # Definir data atual
        data = datetime.now().strftime("%d/%m/%Y")

        return {
            "valor": valor,
            "categoria": categoria,
            "data": data
        }
    except Exception as e:
        raise ValueError(f"Erro ao processar a mensagem: {str(e)}")

async def start(update: Update, context):
    await update.message.reply_text("Olá! Envie uma despesa no formato: 'Gastei R$20 no mercado'.")

async def ajuda(update: Update, context):
    help_text = """
    ✨ Como usar:
    Envie suas despesas como:
    - 'Gastei R$20 no mercado'
    - 'Despesa de R$150 com combustível'
    - 'Almoço R$35 hoje'
    
    📝 Formato aceito:
    Valor | Categoria | Data (opcional)
    """
    await update.message.reply_text(help_text)

async def test(update: Update, context):
    await update.message.reply_text("Test command received!")

async def handle_message(update: Update, context):
    try:
        user_id = update.message.from_user.id
        expense_data = parse_expense(update.message.text)
        
        save_to_firestore(user_id, expense_data)
        
        update_sheet(user_id, expense_data)
        
        response = (
            "💰 Despesa Registrada!\n"
            f"Valor: R${expense_data['valor']:.2f}\n"
            f"Categoria: {expense_data['categoria'].title()}\n"
            f"Data: {expense_data['data']}"
        )
        
        await update.message.reply_text(response)
        
    except Exception as e:
        error_message = f"❌ Erro: {str(e)}\nEnvie no formato: 'Gastei R$50 no mercado hoje'"
        await update.message.reply_text(error_message)

def save_to_firestore(user_id, expense_data):
    """
    Salva os dados da despesa no Firestore.
    Args:
        user_id (str): ID do usuário no Telegram.
        expense_data (dict): Dados da despesa no formato {'valor': float, 'categoria': str, 'data': str}.
    """
    try:
        doc_ref = db.collection("users").document(str(user_id)).collection("expenses").document()
        doc_ref.set(expense_data)
        logger.info(f"Despesa salva no Firestore para o usuário {user_id}.")
    except Exception as e:
        logger.error(f"Erro ao salvar no Firestore: {e}")

def update_sheet(user_id, expense):
    try:
        worksheet.append_row([
            str(user_id), 
            expense["valor"],
            expense["categoria"],
            expense["data"]
        ])
        logger.info("Planilha do Google Sheets atualizada com sucesso!")
    except Exception as e:
        logger.error(f"Erro no Google Sheets: {str(e)}")

def run_bot():
    # Create a new event loop for this thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Build the application
    application = Application.builder().token(TOKEN).build()
    
    # Register handlers
    handlers = [
        CommandHandler("start", start),
        CommandHandler("ajuda", ajuda),
        CommandHandler("test", test),
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    ]
    
    for handler in handlers:
        application.add_handler(handler)
    
    logger.info("Bot is running and polling for updates...")
    
    try:
        # Run the bot using the event loop
        loop.run_until_complete(application.run_polling())
    except Exception as e:
        logger.error(f"Error in run_polling: {e}")
    finally:
        # Clean up the event loop
        loop.close()

if __name__ == "__main__":
    # Start the Telegram bot in a separate thread
    bot_thread = Thread(target=run_bot)
    bot_thread.start()
    
    # Start the Flask server on port 8080
    app.run(host="0.0.0.0", port=8080)
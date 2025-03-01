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
import nest_asyncio  # Import nest_asyncio

# Apply nest_asyncio to allow nested event loops
nest_asyncio.apply()

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
    Extracts expense details from user input.
    Args:
        text (str): User's message.
    Returns:
        dict: Expense details including amount, category, date, description, etc.
    """
    try:
        # Regex patterns for extracting details
        amount_pattern = r"(?P<amount>\d+[\.,]?\d*)\s*(?:reais|rs|r\$)?"
        category_pattern = r"(?:em|no|para|com)\s+(?P<category>\w+)"
        description_pattern = r"(?:para|sobre|descrição|em)\s+(?P<description>.+?)(?:\s+em|\s+no|\s+para|\s+com|$)"
        date_pattern = r"(?P<date>\d{1,2}/\d{1,2}/\d{4})"
        payment_method_pattern = r"(?:paguei|pago)\s+(?:com|em)\s+(?P<payment_method>débito|crédito|pix|dinheiro|transferência\s+bancária)"
        installment_pattern = r"(?:em\s+)?(?P<installments_number>\d+)x"
        location_pattern = r"(?:em|no)\s+(?P<location>.+?)(?:\s+para|\s+com|$)"
        supplier_pattern = r"(?:na|no)\s+(?P<supplier>.+?)(?:\s+em|\s+no|$)"
        currency_pattern = r"(?P<currency>\bUSD\b|\bEUR\b|\bBRL\b)"

        # Extract amount
        amount_match = re.search(amount_pattern, text, re.IGNORECASE)
        if not amount_match:
            raise ValueError("Amount not found. Use: 'Gastei R$20 no mercado'.")
        amount = float(amount_match.group("amount").replace(",", "."))

        # Extract category
        category_match = re.search(category_pattern, text, re.IGNORECASE)
        category = category_match.group("category").lower() if category_match else "outros"

        # Extract description
        description_match = re.search(description_pattern, text, re.IGNORECASE)
        description = description_match.group("description").strip() if description_match else None

        # Extract date (if provided)
        date_match = re.search(date_pattern, text)
        date = date_match.group("date") if date_match else datetime.now().strftime("%d/%m/%Y")

        # Extract payment method
        payment_method_match = re.search(payment_method_pattern, text, re.IGNORECASE)
        payment_method = payment_method_match.group("payment_method").lower() if payment_method_match else None

        # Extract installments
        installment_match = re.search(installment_pattern, text, re.IGNORECASE)
        installments_number = int(installment_match.group("installments_number")) if installment_match else 0
        installment = installments_number > 1

        # Extract location
        location_match = re.search(location_pattern, text, re.IGNORECASE)
        location = location_match.group("location").strip() if location_match else None

        # Extract supplier
        supplier_match = re.search(supplier_pattern, text, re.IGNORECASE)
        supplier = supplier_match.group("supplier").strip() if supplier_match else None

        # Extract currency (default is BRL)
        currency_match = re.search(currency_pattern, text, re.IGNORECASE)
        currency = currency_match.group("currency") if currency_match else "BRL"

        # Return structured expense data
        return {
            "amount": amount,
            "category": category,
            "date": date,
            "description": description,
            "payment_method": payment_method,
            "installment": installment,
            "installments_number": installments_number,
            "location": location,
            "supplier": supplier,
            "notes": None,  # To be filled by user in follow-up
            "tags": [],  # To be filled by user in follow-up
            "geolocation": None,  # To be filled by user in follow-up
            "receipt_link": None,  # To be filled by user in follow-up
            "recurrence": None,  # To be filled by user in follow-up
            "currency": currency,
            "expense_status": "pago",  # Default status
            "budget_alignment": None  # To be filled by user in follow-up
        }
    except Exception as e:
        raise ValueError(f"Error parsing expense: {str(e)}")


# Example usage
input_text = "Gastei R$300 no Posto ABC para abastecer o carro com combustível comum, paguei com débito em 20/05/2024."
parsed_expense = parse_expense(input_text)
print(parsed_expense)

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

def run_flask():
    # Start the Flask server on port 8080
    app.run(host="0.0.0.0", port=8080)

async def run_bot():
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
    await application.run_polling()

if __name__ == "__main__":
    # Start the Flask server in a separate thread
    flask_thread = Thread(target=run_flask)
    flask_thread.start()
    
    # Run the Telegram bot in the main thread
    asyncio.run(run_bot())
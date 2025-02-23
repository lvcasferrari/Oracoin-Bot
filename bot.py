from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters
import json
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore
import re
import gspread

gc = gspread.service_account(filename="firebase-key.json")
sh = gc.open_by_key("1ERwkHzq_VvKivAzwi3vHcRl90RAz2xC70bVM6pXV1Z8")
worksheet = sh.sheet1

TOKEN = "7615128166:AAF8z0P0pw2HnhaC1mRk_NXLorFMDHxRbMU"

# Inicializar Firebase
cred = credentials.Certificate("firebase-key.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Função para atualizar a planilha do Google Sheets
def update_sheet(user_id, expense):
    try:
        worksheet.append_row([
            str(user_id), 
            expense["valor"],
            expense["categoria"],
            expense["data"]
        ])
        print("Planilha do Google Sheets atualizada com sucesso!")
    except Exception as e:
        print(f"Erro no Google Sheets: {str(e)}")

# Função para salvar dados no Firestore
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
        print(f"Despesa salva no Firestore para o usuário {user_id}.")
    except Exception as e:
        print(f"Erro ao salvar no Firestore: {e}")

# Função para responder ao comando /start
async def start(update: Update, context):
    await update.message.reply_text("Olá! Envie uma despesa no formato: 'Gastei R$20 no mercado'.")

# Função para responder ao comando /ajuda
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

# Função para processar a mensagem localmente (sem OpenAI)
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

# Lidar com mensagens do usuário
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

# Configurar e iniciar o bot
def main():
    application = Application.builder().token(TOKEN).build()
    
    # Registar handlers
    handlers = [
        CommandHandler("start", start),
        CommandHandler("ajuda", ajuda),
        MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message)
    ]
    
    for handler in handlers:
        application.add_handler(handler)
    
    print("Bot em execução...")
    application.run_polling()

if __name__ == "__main__":
    main()
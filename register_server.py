import os
import csv
import threading
import webbrowser
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

ARCHIVO_USUARIOS = "users.csv"

CAMPOS = [
    "id_usuario",
    "nombre",
    "apellidos",
    "email",
    "password",
    "telefono",
    "distrito",
    "calle",
    "latitud",
    "longitud",
]

def obtener_siguiente_id():
    if not os.path.exists(ARCHIVO_USUARIOS):
        return 1
    with open(ARCHIVO_USUARIOS, encoding="utf-8") as f:
        filas = list(csv.DictReader(f))
    if not filas:
        return 1
    return max(int(r.get("id_usuario", 0)) for r in filas) + 1

def email_existe(email):
    if not os.path.exists(ARCHIVO_USUARIOS):
        return False
    with open(ARCHIVO_USUARIOS, encoding="utf-8") as f:
        for fila in csv.DictReader(f):
            if fila.get("email", "").lower() == email.lower():
                return True
    return False

@app.route("/register", methods=["POST"])
def registrar():
    data = request.get_json()

    campos_requeridos = ["nombre","apellidos","email","password",
                         "telefono","distrito","latitud","longitud"]
    for campo in campos_requeridos:
        if not data.get(campo, "").strip():
            return jsonify({"ok": False, "error": f"Falta el campo: {campo}"}), 400

    if email_existe(data["email"]):
        return jsonify({"ok": False, "error": "Este correo ya está registrado."}), 409

    nuevo = {
        "id_usuario": obtener_siguiente_id(),
        "nombre"    : data["nombre"].strip(),
        "apellidos" : data["apellidos"].strip(),
        "email"     : data["email"].strip(),
        "password"  : data["password"],
        "telefono"  : data["telefono"].strip(),
        "distrito"  : data["distrito"].strip(),
        "calle"     : data.get("calle", "Sin nombre").strip(),
        "latitud"   : data["latitud"].strip(),
        "longitud"  : data["longitud"].strip(),
    }

    archivo_nuevo = not os.path.exists(ARCHIVO_USUARIOS)

    with open(ARCHIVO_USUARIOS, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CAMPOS)
        if archivo_nuevo:
            writer.writeheader()
        writer.writerow(nuevo)

    print(f"[OK] Usuario #{nuevo['id_usuario']} registrado: {nuevo['email']}")

    return jsonify({
        "ok"        : True,
        "id_usuario": nuevo["id_usuario"],
        "nombre"    : nuevo["nombre"],
        "apellidos" : nuevo["apellidos"],
        "email"     : nuevo["email"],
        "distrito"  : nuevo["distrito"],
        "calle"     : nuevo["calle"],
        "latitud"   : nuevo["latitud"],
        "longitud"  : nuevo["longitud"],
    })

@app.route("/users", methods=["GET"])
def listar_usuarios():
    if not os.path.exists(ARCHIVO_USUARIOS):
        return jsonify([])
    with open(ARCHIVO_USUARIOS, encoding="utf-8") as f:
        filas = list(csv.DictReader(f))
    return jsonify(filas)

if __name__ == "__main__":
    print("=" * 45)
    print("  TrackMarket — Servidor de Registro")
    print("=" * 45)
    print(f"  API corriendo en: http://localhost:5000")
    print(f"  Usuarios en:      {ARCHIVO_USUARIOS}")
    print("  Abre Live Server normalmente en VS Code")
    print("  Deja esta terminal abierta mientras usas la app")
    print("=" * 45)
    app.run(debug=False, port=5000)

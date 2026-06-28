import os
import random
import pandas as pd

ARCHIVO_RESTAURANTES = "restaurants.csv"
ARCHIVO_SALIDA       = "products.csv"

MIN_PROD  = 3
MAX_PROD  = 8
MIN_PRECIO = 5.0
MAX_PRECIO = 55.0

PRODUCTOS_POR_TIPO = {
    "Cevichería": [
        "Ceviche clásico", "Ceviche mixto", "Leche de tigre",
        "Tiradito", "Arroz con mariscos", "Sudado de pescado",
        "Choritos a la chalaca", "Pulpo al olivo",
    ],
    "Pollería": [
        "Pollo a la brasa 1/4", "Pollo a la brasa 1/2",
        "Pollo a la brasa entero", "Papas fritas", "Ensalada",
        "Anticucho", "Chicharrón de pollo", "Chorizo parrillero",
    ],
    "Chifa": [
        "Arroz chaufa", "Lomo saltado", "Tallarín saltado",
        "Wantán frito", "Aeropuerto", "Sopa wantán",
        "Kam lu wantán", "Arroz frito especial",
    ],
    "Pizzería": [
        "Pizza personal", "Pizza mediana", "Pizza familiar",
        "Calzone", "Pasta bolognesa", "Lasagna",
        "Pan al ajo", "Bruschetta",
    ],
    "Hamburguesería": [
        "Hamburguesa clásica", "Hamburguesa doble", "Combo burger",
        "Papas fritas", "Alitas BBQ", "Hotdog",
        "Nuggets", "Onion rings",
    ],
    "Restaurante Criollo": [
        "Lomo saltado", "Ají de gallina", "Arroz con leche",
        "Seco de pollo", "Tacu tacu", "Carapulcra",
        "Causa limeña", "Escabeche de pollo",
    ],
    "Sushi": [
        "Roll California", "Roll tempura", "Nigiri salmón",
        "Sashimi mixto", "Roll especial", "Edamame",
        "Miso soup", "Gyoza",
    ],
    "Sanguchería": [
        "Sánguche de chicharrón", "Butifarra", "Pan con peperoni",
        "Triple mixto", "Sánguche de pollo", "Club sándwich",
        "Pan con bistec", "Pan con jamón del país",
    ],
    "Parrilla": [
        "Parrilla mixta", "Lomo fino", "Costillas BBQ",
        "Chorizo artesanal", "Anticucho", "Salchicha parrillera",
        "Pollo a la parrilla", "Mollejas a la parrilla",
    ],
    "Fusión": [
        "Bowl de quinoa", "Tacos de lomo", "Ceviche nikkei",
        "Poke bowl", "Ramen criollo", "Tarta de maíz morado",
        "Risotto andino", "Tiradito fusión",
    ],
}

PRECIO_BASE_POR_TIPO = {
    "Cevichería"         : (18.0, 50.0),
    "Pollería"           : (8.0,  45.0),
    "Chifa"              : (12.0, 35.0),
    "Pizzería"           : (10.0, 55.0),
    "Hamburguesería"     : (8.0,  40.0),
    "Restaurante Criollo": (12.0, 38.0),
    "Sushi"              : (15.0, 65.0),
    "Sanguchería"        : (7.0,  28.0),
    "Parrilla"           : (18.0, 70.0),
    "Fusión"             : (14.0, 55.0),
}
PRECIO_FALLBACK = (10.0, 40.0)

def precio_para(tipo: str) -> float:
    lo, hi = PRECIO_BASE_POR_TIPO.get(tipo, PRECIO_FALLBACK)
    precio = random.uniform(lo, hi)
    precio = max(MIN_PRECIO, min(MAX_PRECIO, precio))
    return round(precio, 2)

def main():
    if os.path.exists(ARCHIVO_SALIDA):
        print(f"[OK] '{ARCHIVO_SALIDA}' ya existe — no se sobreescribe.")
        return

    if not os.path.exists(ARCHIVO_RESTAURANTES):
        print(f"[ERROR] No se encontró '{ARCHIVO_RESTAURANTES}'.")
        print("        Ejecuta primero: restaurants.py")
        return

    print(f"Leyendo '{ARCHIVO_RESTAURANTES}'…")
    df_rest = pd.read_csv(ARCHIVO_RESTAURANTES, encoding="utf-8")

    if df_rest.empty:
        print("[ERROR] El archivo de restaurantes está vacío.")
        return

    print(f"  {len(df_rest)} restaurantes encontrados.")
    print(f"Generando productos (entre {MIN_PROD} y {MAX_PROD} por restaurante)…")

    filas = []
    pid   = 1

    for _, rest in df_rest.iterrows():
        id_rest = int(rest["id_restaurante"])
        tipo    = str(rest.get("tipo", "")).strip()

        pool = PRODUCTOS_POR_TIPO.get(tipo, PRODUCTOS_POR_TIPO["Restaurante Criollo"])

        cantidad = random.randint(MIN_PROD, min(MAX_PROD, len(pool)))

        seleccion = random.sample(pool, cantidad)

        for nombre_prod in seleccion:
            filas.append({
                "id_producto"    : pid,
                "id_restaurante" : id_rest,
                "nombre_producto": nombre_prod,
                "categoria"      : tipo,
                "precio_soles"   : precio_para(tipo),
                "descripcion"    : f"{nombre_prod} preparado al estilo {tipo.lower()}",
                "disponible"     : "SI" if random.random() > 0.15 else "NO",
            })
            pid += 1

    df_prod = pd.DataFrame(filas)
    df_prod.to_csv(ARCHIVO_SALIDA, index=False, encoding="utf-8")

    print(f"\nResumen:")
    print(f"  Productos generados    : {len(df_prod)}")
    print(f"  Restaurantes cubiertos : {df_prod['id_restaurante'].nunique()}")
    print(f"  Precio mínimo          : S/ {df_prod['precio_soles'].min():.2f}")
    print(f"  Precio máximo          : S/ {df_prod['precio_soles'].max():.2f}")
    print(f"  Precio promedio        : S/ {df_prod['precio_soles'].mean():.2f}")
    print(f"\n[OK] Archivo creado: '{ARCHIVO_SALIDA}'")


if __name__ == "__main__":
    main()
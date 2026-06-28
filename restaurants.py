import os
import random
import pandas as pd
import osmnx as ox
from shapely.ops import unary_union
from shapely.geometry import Point

ARCHIVO_SALIDA    = "restaurants.csv"
NUM_RESTAURANTES  = 30
LUGARES = [
    "Chorrillos, Lima, Peru",
    "Barranco, Lima, Peru",
    "Miraflores, Lima, Peru",
]

TIPOS = [
    "Cevichería", "Pollería", "Chifa", "Pizzería", "Hamburguesería",
    "Restaurante Criollo", "Sushi", "Sanguchería", "Parrilla", "Fusión",
]

NOMBRES_BASE = [
    "El Sabor", "La Esquina", "Don Juan", "La Marina", "El Rincón",
    "Los Amigos", "La Brasa", "El Mar", "La Cocina", "Mi Tierra",
    "El Punto", "La Plaza", "Don Pepe", "La Bahía", "El Refugio",
]

CALLES = [
    "Grau", "Larco", "Bolognesi", "Primavera", "Balta",
    "José Pardo", "Reducto", "Benavides", "Armendáriz", "Los Laureles",
]

def punto_aleatorio_en_poligono(poligono, intentos: int = 200) -> Point:
    minx, miny, maxx, maxy = poligono.bounds
    for _ in range(intentos):
        p = Point(
            random.uniform(minx, maxx),
            random.uniform(miny, maxy),
        )
        if poligono.contains(p):
            return p
    return poligono.centroid


def obtener_distrito(punto: Point, poligonos: list, nombres: list) -> str:
    for poligono, nombre in zip(poligonos, nombres):
        if poligono.contains(punto):
            return nombre
    return "Otro"

def main():
    if os.path.exists(ARCHIVO_SALIDA):
        print(f"[OK] '{ARCHIVO_SALIDA}' ya existe — no se sobreescribe.")
        return

    print("Descargando polígonos de los distritos…")
    poligonos = [
        ox.geocode_to_gdf(lugar).geometry.values[0]
        for lugar in LUGARES
    ]
    nombres_distritos = [l.split(",")[0] for l in LUGARES]
    area_total = unary_union(poligonos)

    print(f"Área total: {area_total.area:.6f} grados²")
    print(f"Generando {NUM_RESTAURANTES} restaurantes…")

    filas = []
    for i in range(1, NUM_RESTAURANTES + 1):
        idx_dist = random.randint(0, len(poligonos) - 1)
        poligono = poligonos[idx_dist]
        distrito = nombres_distritos[idx_dist]

        punto = punto_aleatorio_en_poligono(poligono)
        lat   = round(punto.y, 6)
        lon   = round(punto.x, 6)

        tipo    = random.choice(TIPOS)
        nombre  = random.choice(NOMBRES_BASE) + " " + tipo.split()[0]
        horario = f"{random.randint(7, 10)}:00 - {random.randint(20, 23)}:00"
        tel     = f"9{random.randint(10000000, 99999999)}"
        rating  = round(random.uniform(3.2, 5.0), 1)
        calle   = random.choice(CALLES)
        numero  = random.randint(100, 999)
        dir_    = f"Av. {calle} {numero}, {distrito}"

        filas.append({
            "id_restaurante": i,
            "nombre"        : nombre,
            "tipo"          : tipo,
            "distrito"      : distrito,
            "latitud"       : lat,
            "longitud"      : lon,
            "direccion"     : dir_,
            "horario"       : horario,
            "telefono"      : tel,
            "rating"        : rating,
        })

    df = pd.DataFrame(filas)
    df.to_csv(ARCHIVO_SALIDA, index=False, encoding="utf-8")

    print(f"\nResumen:")
    print(f"  Restaurantes generados : {len(df)}")
    print(f"  Distritos cubiertos    : {df['distrito'].nunique()}")
    print(df["distrito"].value_counts().to_string())
    print(f"\n[OK] Archivo creado: '{ARCHIVO_SALIDA}'")


if __name__ == "__main__":
    main()
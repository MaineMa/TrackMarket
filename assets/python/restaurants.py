import os
import random
import pandas as pd
import osmnx as ox

from shapely.ops import unary_union
from shapely.geometry import Point

_DIR = os.path.dirname(os.path.abspath(__file__))
ARCHIVO_SALIDA   = os.path.join(_DIR, "..", "csvs", "restaurants.csv")
NUM_RESTAURANTES = 30

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

def obtener_distrito(lat, lon, poligonos, nombres):
    punto = Point(lon, lat)
    for poligono, nombre in zip(poligonos, nombres):
        if poligono.contains(punto):
            return nombre
    return "Otro"


def main():

    if os.path.exists(ARCHIVO_SALIDA):
        print(f"[OK] '{ARCHIVO_SALIDA}' ya existe — no se sobreescribe.")
        return

    print("Descargando polígonos…")
    poligonos = [
        ox.geocode_to_gdf(lugar).geometry.values[0]
        for lugar in LUGARES
    ]

    nombres_distritos = [l.split(",")[0] for l in LUGARES]
    area_total = unary_union(poligonos)

    print("Descargando grafo vial…")
    G = ox.graph_from_polygon(area_total, network_type="drive")

    print(f"Nodos: {G.number_of_nodes()} | Aristas: {G.number_of_edges()}")

    nodos_por_distrito = {
        nombre: []
        for nombre in nombres_distritos
    }

    for nodo, data in G.nodes(data=True):

        punto = Point(data["x"], data["y"])

        for lugar, poligono in zip(LUGARES, poligonos):

            if poligono.contains(punto):

                nombre = lugar.split(",")[0]
                nodos_por_distrito[nombre].append(nodo)
                break

    filas = []

    for i in range(1, NUM_RESTAURANTES + 1):

        distrito = random.choice(nombres_distritos)

        nodo = random.choice(nodos_por_distrito[distrito])

        lat = round(G.nodes[nodo]["y"], 6)
        lon = round(G.nodes[nodo]["x"], 6)

        tipo   = random.choice(TIPOS)
        nombre = random.choice(NOMBRES_BASE) + " " + tipo.split()[0]

        vecinos = list(G.edges(nodo, data=True))
        if vecinos:
            calle = vecinos[0][2].get("name", "Sin nombre")
        else:
            calle = "Sin nombre"

        direccion = f"{calle} {random.randint(100,999)}, {distrito}"

        horario = f"{random.randint(7,10)}:00 - {random.randint(20,23)}:00"
        tel     = f"9{random.randint(10000000, 99999999)}"
        rating  = round(random.uniform(3.2, 5.0), 1)

        filas.append({
            "id_restaurante": i,
            "nombre": nombre,
            "tipo": tipo,
            "distrito": distrito,
            "latitud": lat,
            "longitud": lon,
            "direccion": direccion,
            "horario": horario,
            "telefono": tel,
            "rating": rating,
        })

    df = pd.DataFrame(filas)
    df.to_csv(ARCHIVO_SALIDA, index=False, encoding="utf-8")

    print("\n[OK] Dataset creado")
    print(df["distrito"].value_counts())


if __name__ == "__main__":
    main()
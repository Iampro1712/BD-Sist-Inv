from django.db import connection

cursor = connection.cursor()
cursor.execute("""
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname='public' 
    ORDER BY tablename
""")

tables = [row[0] for row in cursor.fetchall()]
print("\n=== Tablas en la base de datos ===")
for table in tables:
    print(f"  - {table}")

print("\n=== Tablas relacionadas con ventas/órdenes ===")
for table in tables:
    if 'venta' in table.lower() or 'orden' in table.lower():
        print(f"  - {table}")

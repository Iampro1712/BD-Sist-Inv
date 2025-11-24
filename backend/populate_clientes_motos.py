"""
Script para poblar la base de datos con clientes, motos y servicios de prueba
"""
import os
import sys
import django
from datetime import date, timedelta
from decimal import Decimal

# Configurar Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from inventory.models import Cliente, Moto, ServicioMoto


def crear_datos_prueba():
    """Crear datos de prueba para clientes, motos y servicios"""
    
    print("🚀 Iniciando población de datos de prueba...")
    
    # Datos de clientes con sus motos
    clientes_data = [
        {
            'nombre': 'Juan Pérez',
            'telefono': '809-555-0101',
            'email': 'juan.perez@email.com',
            'motos': [
                {
                    'marca': 'Honda',
                    'modelo': 'CB190R',
                    'anio': 2022,
                    'placa': 'A123456',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=30),
                            'tipo': 'Cambio de aceite',
                            'descripcion': 'Cambio de aceite y filtro, revisión general',
                            'costo': Decimal('550.00')
                        },
                        {
                            'fecha': date.today() - timedelta(days=90),
                            'tipo': 'Mantenimiento preventivo',
                            'descripcion': 'Ajuste de cadena, revisión de frenos',
                            'costo': Decimal('920.00')
                        }
                    ]
                }
            ]
        },
        {
            'nombre': 'María González',
            'telefono': '809-555-0102',
            'email': 'maria.gonzalez@email.com',
            'motos': [
                {
                    'marca': 'Yamaha',
                    'modelo': 'FZ-16',
                    'anio': 2021,
                    'placa': 'B234567',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=15),
                            'tipo': 'Reparación de frenos',
                            'descripcion': 'Cambio de pastillas de freno delanteras',
                            'costo': Decimal('1180.00')
                        }
                    ]
                },
                {
                    'marca': 'Yamaha',
                    'modelo': 'NMAX 155',
                    'anio': 2023,
                    'placa': 'B234568',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=45),
                            'tipo': 'Cambio de aceite',
                            'descripcion': 'Cambio de aceite sintético y filtro',
                            'costo': Decimal('660.00')
                        }
                    ]
                }
            ]
        },
        {
            'nombre': 'Carlos Rodríguez',
            'telefono': '809-555-0103',
            'email': 'carlos.rodriguez@email.com',
            'motos': [
                {
                    'marca': 'Suzuki',
                    'modelo': 'GN125',
                    'anio': 2020,
                    'placa': 'C345678',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=60),
                            'tipo': 'Mantenimiento general',
                            'descripcion': 'Cambio de aceite, ajuste de carburador, limpieza de filtro',
                            'costo': Decimal('1030.00')
                        },
                        {
                            'fecha': date.today() - timedelta(days=120),
                            'tipo': 'Cambio de neumáticos',
                            'descripcion': 'Cambio de neumático trasero',
                            'costo': Decimal('1650.00')
                        }
                    ]
                }
            ]
        },
        {
            'nombre': 'Ana Martínez',
            'telefono': '809-555-0104',
            'email': 'ana.martinez@email.com',
            'motos': [
                {
                    'marca': 'Honda',
                    'modelo': 'PCX 150',
                    'anio': 2023,
                    'placa': 'D456789',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=20),
                            'tipo': 'Cambio de aceite',
                            'descripcion': 'Primer servicio - cambio de aceite y revisión',
                            'costo': Decimal('590.00')
                        }
                    ]
                }
            ]
        },
        {
            'nombre': 'Luis Fernández',
            'telefono': '809-555-0105',
            'email': 'luis.fernandez@email.com',
            'motos': [
                {
                    'marca': 'Kawasaki',
                    'modelo': 'Ninja 400',
                    'anio': 2022,
                    'placa': 'E567890',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=10),
                            'tipo': 'Reparación eléctrica',
                            'descripcion': 'Cambio de batería y revisión del sistema eléctrico',
                            'costo': Decimal('1290.00')
                        },
                        {
                            'fecha': date.today() - timedelta(days=75),
                            'tipo': 'Cambio de aceite',
                            'descripcion': 'Cambio de aceite sintético y filtro',
                            'costo': Decimal('735.00')
                        }
                    ]
                },
                {
                    'marca': 'Kawasaki',
                    'modelo': 'Z125 Pro',
                    'anio': 2021,
                    'placa': 'E567891',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=40),
                            'tipo': 'Mantenimiento preventivo',
                            'descripcion': 'Revisión general y ajustes',
                            'costo': Decimal('810.00')
                        }
                    ]
                }
            ]
        },
        {
            'nombre': 'Patricia Sánchez',
            'telefono': '809-555-0106',
            'email': 'patricia.sanchez@email.com',
            'motos': [
                {
                    'marca': 'Bajaj',
                    'modelo': 'Pulsar NS200',
                    'anio': 2021,
                    'placa': 'F678901',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=25),
                            'tipo': 'Cambio de cadena',
                            'descripcion': 'Cambio de kit de arrastre completo',
                            'costo': Decimal('2025.00')
                        }
                    ]
                }
            ]
        },
        {
            'nombre': 'Roberto Díaz',
            'telefono': '809-555-0107',
            'email': 'roberto.diaz@email.com',
            'motos': [
                {
                    'marca': 'Honda',
                    'modelo': 'Wave 110',
                    'anio': 2019,
                    'placa': 'G789012',
                    'servicios': [
                        {
                            'fecha': date.today() - timedelta(days=50),
                            'tipo': 'Cambio de aceite',
                            'descripcion': 'Cambio de aceite mineral y limpieza',
                            'costo': Decimal('440.00')
                        },
                        {
                            'fecha': date.today() - timedelta(days=100),
                            'tipo': 'Reparación de motor',
                            'descripcion': 'Ajuste de válvulas y limpieza de carburador',
                            'costo': Decimal('1470.00')
                        },
                        {
                            'fecha': date.today() - timedelta(days=150),
                            'tipo': 'Cambio de neumáticos',
                            'descripcion': 'Cambio de ambos neumáticos',
                            'costo': Decimal('2210.00')
                        }
                    ]
                }
            ]
        }
    ]
    
    # Crear clientes, motos y servicios
    for cliente_data in clientes_data:
        # Crear o actualizar cliente
        cliente, created = Cliente.objects.update_or_create(
            email=cliente_data['email'],
            defaults={
                'nombre': cliente_data['nombre'],
                'telefono': cliente_data['telefono']
            }
        )
        
        if created:
            print(f"✅ Cliente creado: {cliente.nombre}")
        else:
            print(f"🔄 Cliente actualizado: {cliente.nombre}")
        
        # Crear motos para el cliente
        for moto_data in cliente_data['motos']:
            moto, moto_created = Moto.objects.update_or_create(
                placa=moto_data['placa'],
                defaults={
                    'id_cliente': cliente,
                    'marca': moto_data['marca'],
                    'modelo': moto_data['modelo'],
                    'anio': moto_data['anio']
                }
            )
            
            if moto_created:
                print(f"  🏍️  Moto creada: {moto.marca} {moto.modelo} - {moto.placa}")
            else:
                print(f"  🔄 Moto actualizada: {moto.marca} {moto.modelo} - {moto.placa}")
            
            # Crear servicios para la moto
            for servicio_data in moto_data['servicios']:
                servicio, servicio_created = ServicioMoto.objects.get_or_create(
                    id_moto=moto,
                    fecha_servicio=servicio_data['fecha'],
                    tipo_servicio=servicio_data['tipo'],
                    defaults={
                        'descripcion': servicio_data['descripcion'],
                        'costo': servicio_data['costo']
                    }
                )
                
                if servicio_created:
                    print(f"    🔧 Servicio creado: {servicio.tipo_servicio} - ${servicio.costo}")
    
    print("\n✨ Población de datos completada exitosamente!")
    
    # Mostrar resumen
    total_clientes = Cliente.objects.count()
    total_motos = Moto.objects.count()
    total_servicios = ServicioMoto.objects.count()
    
    print(f"\n📊 Resumen:")
    print(f"   Clientes: {total_clientes}")
    print(f"   Motos: {total_motos}")
    print(f"   Servicios: {total_servicios}")


if __name__ == '__main__':
    crear_datos_prueba()

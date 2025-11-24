"""
Script para visualizar los datos de clientes, motos y servicios
"""
import os
import sys
import django

# Configurar Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'inventrix.settings')
django.setup()

from inventory.models import Cliente, Moto, ServicioMoto

def mostrar_datos():
    """Mostrar todos los datos de clientes con sus motos y servicios"""
    
    print("=" * 80)
    print("📊 DATOS DE CLIENTES, MOTOS Y SERVICIOS")
    print("=" * 80)
    
    clientes = Cliente.objects.all().order_by('nombre')
    
    for cliente in clientes:
        motos = Moto.objects.filter(id_cliente=cliente)
        
        if motos.exists():
            print(f"\n👤 Cliente: {cliente.nombre}")
            print(f"   📞 Teléfono: {cliente.telefono}")
            print(f"   📧 Email: {cliente.email}")
            print(f"   🏍️  Motos: {motos.count()}")
            
            for moto in motos:
                print(f"\n   🏍️  {moto.marca} {moto.modelo} ({moto.anio})")
                print(f"      Placa: {moto.placa}")
                
                servicios = ServicioMoto.objects.filter(id_moto=moto).order_by('-fecha_servicio')
                
                if servicios.exists():
                    print(f"      Servicios realizados: {servicios.count()}")
                    for servicio in servicios:
                        print(f"      🔧 {servicio.fecha_servicio} - {servicio.tipo_servicio}")
                        print(f"         {servicio.descripcion}")
                        print(f"         Costo: C${servicio.costo}")
                else:
                    print("      Sin servicios registrados")
            
            print("-" * 80)
    
    # Resumen general
    total_clientes = Cliente.objects.count()
    total_motos = Moto.objects.count()
    total_servicios = ServicioMoto.objects.count()
    clientes_con_motos = Cliente.objects.filter(motos__isnull=False).distinct().count()
    
    print(f"\n{'=' * 80}")
    print("📈 RESUMEN GENERAL")
    print(f"{'=' * 80}")
    print(f"Total de clientes: {total_clientes}")
    print(f"Clientes con motos: {clientes_con_motos}")
    print(f"Total de motos: {total_motos}")
    print(f"Total de servicios: {total_servicios}")
    print(f"Promedio de motos por cliente: {total_motos / clientes_con_motos:.2f}")
    print(f"Promedio de servicios por moto: {total_servicios / total_motos:.2f}")
    
    # Estadísticas de servicios
    from django.db.models import Sum, Avg, Count
    
    stats = ServicioMoto.objects.aggregate(
        total_ingresos=Sum('costo'),
        costo_promedio=Avg('costo'),
        total_servicios=Count('id_servicio')
    )
    
    print(f"\n💰 ESTADÍSTICAS DE SERVICIOS")
    print(f"Total de ingresos por servicios: C${stats['total_ingresos']:.2f}")
    print(f"Costo promedio por servicio: C${stats['costo_promedio']:.2f}")
    
    # Servicios más comunes
    from django.db.models import Count
    servicios_comunes = ServicioMoto.objects.values('tipo_servicio').annotate(
        cantidad=Count('id_servicio')
    ).order_by('-cantidad')[:5]
    
    print(f"\n🔧 SERVICIOS MÁS COMUNES")
    for i, servicio in enumerate(servicios_comunes, 1):
        print(f"{i}. {servicio['tipo_servicio']}: {servicio['cantidad']} veces")
    
    print(f"\n{'=' * 80}\n")

if __name__ == '__main__':
    mostrar_datos()

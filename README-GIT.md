# Sincronización de Unidad de Medida por Producto en Ventas (Git / Nube)

Este paquete incluye el archivo actualizado `PosSalesWindow.tsx` y un parche `pos-sales-unit-sync.patch` con todos los cambios aplicados:

1. Detección automática de la unidad con la que fue creado cada producto (`Litros (L)` -> `L`, `Peso (kg)` -> `kg`, `Gramos (g)` -> `g`, `Mililitros (ml)` -> `ml`, `Metros (m)` -> `m`, o `ud` por defecto).
2. Selector `Unidad` / `Medida (<unidad>)` en **Factura en Curso** reflejando la unidad real del producto.
3. Cálculo de totales por unidad o por medida con su abreviatura correspondiente.
4. Soporte de moneda `COP` y actualización de totales/cobro.

## Pasos para llevar a tu repositorio Git y subir a la nube

```bash
# 1. Ubícate en la raíz de tu repositorio local
cd /ruta/a/tu/repo

# 2. Copia PosSalesWindow.tsx a la ruta de tu proyecto (ajusta si usas src/ o components/)
cp /ruta/extraida/src/components/PosSalesWindow.tsx src/components/PosSalesWindow.tsx
# o si tu carpeta es components/PosSalesWindow.tsx:
# cp /ruta/extraida/components/PosSalesWindow.tsx components/PosSalesWindow.tsx

# 3. Revisa los cambios y haz commit + push a la nube
git status
git add .
git commit -m "feat(pos): mostrar y calcular unidad de medida configurada por producto en facturación"
git push origin main
```

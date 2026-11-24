// components/RoleEntryGate.tsx
"use client";

import React, { useState } from "react";
import { ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import { RolUsuario } from "@/types/genesis";
import AdminAuthModal from "./AdminAuthModal";

interface RoleEntryGateProps {
  onSeleccionarRol: (rol: RolUsuario) => void;
}

export default function RoleEntryGate({ onSeleccionarRol }: RoleEntryGateProps) {
  const [modalAdminAbierto, setModalAdminAbierto] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] p-4 sm:p-6">
      <div className="w-full max-w-3xl rounded-2xl border border-[#E5E7EB] bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 text-sm font-bold text-white">
              G
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Génesis Workspace</h1>
              <p className="text-xs text-gray-500">
                Selecciona tu perfil para abrir directamente el módulo de Ventas
              </p>
            </div>
          </div>
          <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-1 text-xs font-medium text-gray-600">
            Estilo Fina · Claro
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => onSeleccionarRol("operador")}
            className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 text-left transition-all hover:border-gray-900 hover:bg-white"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#E5E7EB] bg-white text-gray-800">
                  <UserCheck className="h-4 w-4" />
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Sin contraseña
                </span>
              </div>
              <h2 className="mt-4 text-base font-semibold text-gray-900">Entrar como Operador</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Acceso directo a Ventas en pestaña independiente. Solicita clave de administrador
                únicamente para descuentos o fiado.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-gray-900">
              <span>Abrir Ventas</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setModalAdminAbierto(true)}
            className="group flex flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-5 text-left transition-all hover:border-gray-900 hover:bg-white"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900 text-white">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="rounded-full border border-[#E5E7EB] bg-white px-2.5 py-0.5 text-[11px] font-semibold text-gray-700">
                  Requiere clave
                </span>
              </div>
              <h2 className="mt-4 text-base font-semibold text-gray-900">Entrar como Administrador</h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500">
                Acceso completo a Ventas, Productos, Clientes Afiliados, Proveedores, Facturas,
                Auditoría y configuración de tasa.
              </p>
            </div>

            <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-gray-900">
              <span>Ingresar con clave</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </button>
        </div>
      </div>

      <AdminAuthModal
        abierto={modalAdminAbierto}
        motivo="Inicia sesión como Administrador para habilitar todos los módulos"
        onCerrar={() => setModalAdminAbierto(false)}
        onExito={() => {
          setModalAdminAbierto(false);
          onSeleccionarRol("administrador");
        }}
      />
    </div>
  );
}

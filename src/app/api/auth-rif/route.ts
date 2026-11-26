import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { normalizeRif } from "@/lib/rif";

function verifyAccessKey(accessKey: string, storedHashHex: string): boolean {
  const salt = process.env.COMMERCE_PIN_SALT || "genesis-default-salt-change-me";
  const derived = crypto.scryptSync(accessKey, salt, 64);
  const stored = Buffer.from(storedHashHex, "hex");
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rif = normalizeRif(String(body.rif || ""));
    const accessKey = String(body.accessKey || "");

    if (!rif || !accessKey) {
      return NextResponse.json(
        { error: "Debes ingresar tu RIF y clave de acceso." },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Faltan variables de entorno de Supabase en el servidor." },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: account, error } = await supabase
      .from("commerce_accounts")
      .select("id, rif, company_name, access_key_hash, is_active")
      .eq("rif", rif)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!account || !account.is_active) {
      return NextResponse.json(
        { error: "RIF no afiliado o cuenta inactiva." },
        { status: 401 }
      );
    }

    const valid = verifyAccessKey(accessKey, account.access_key_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Clave de acceso incorrecta." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      ok: true,
      session: {
        rif: account.rif,
        companyName: account.company_name,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al iniciar sesión con el RIF." },
      { status: 500 }
    );
  }
}

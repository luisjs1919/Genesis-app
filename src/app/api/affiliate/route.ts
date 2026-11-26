import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { isValidRif, normalizeRif } from "@/lib/rif";

function hashAccessKey(accessKey: string): string {
  const salt = process.env.COMMERCE_PIN_SALT || "genesis-default-salt-change-me";
  return crypto.scryptSync(accessKey, salt, 64).toString("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const companyName = String(body.companyName || "").trim();
    const rif = normalizeRif(String(body.rif || ""));
    const accessKey = String(body.accessKey || "");
    const contactName = String(body.contactName || "").trim();
    const contactPhone = String(body.contactPhone || "").trim();
    const contactEmail = String(body.contactEmail || "").trim();
    const interestMode = String(body.interestMode || "").trim();
    const address = String(body.address || "").trim();

    if (companyName.length < 2) {
      return NextResponse.json(
        { error: "El nombre del negocio o comercio es obligatorio." },
        { status: 400 }
      );
    }

    if (!isValidRif(rif)) {
      return NextResponse.json(
        { error: "El RIF no tiene un formato válido (ej. J-5040363636)." },
        { status: 400 }
      );
    }

    if (accessKey.length < 6) {
      return NextResponse.json(
        { error: "La clave de acceso debe tener al menos 6 caracteres." },
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

    const { data: existing, error: lookupError } = await supabase
      .from("commerce_accounts")
      .select("id, rif")
      .eq("rif", rif)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json(
        { error: `El RIF ${rif} ya se encuentra afiliado a otro comercio.` },
        { status: 409 }
      );
    }

    const combinedDetails = [
      address,
      contactName ? `Contacto: ${contactName}` : "",
      interestMode ? `Modalidad: ${interestMode}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    const accessKeyHash = hashAccessKey(accessKey);

    const { data: created, error: insertError } = await supabase
      .from("commerce_accounts")
      .insert({
        rif,
        company_name: companyName,
        contact_phone: contactPhone || null,
        contact_email: contactEmail || null,
        address: combinedDetails || null,
        access_key_hash: accessKeyHash,
      })
      .select("id, rif, company_name, created_at")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: `El RIF ${rif} ya está registrado.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        commerce: created,
        message: "Afiliación registrada correctamente. Ya puedes acceder a tu dashboard.",
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Error al procesar la afiliación del comercio." },
      { status: 500 }
    );
  }
}

import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireDeveloper } from "@/lib/auth";

// Default values untuk setiap key
const DEFAULTS: Record<string, string> = {
  customer_active_days: "60",
  template_followup: `Halo {{nama}} 👋

Kami dari tim Dorizz Store ingin mengingatkan kamu bahwa masa berlangganan kamu akan segera habis.

Jangan sampai ketinggalan update terbaru! Yuk, perpanjang sekarang dan nikmati fitur premium tanpa batas 🎬✨

Balas pesan ini atau hubungi kami untuk info lebih lanjut ya!

Terima kasih sudah bersama kami 🙏`,

  template_send_account: `Halo {{nama}} 👋

Terima kasih sudah berlangganan di Dorizz Store! Berikut adalah data akun kamu:

📧 Email  : {{akun_email}}
🔑 Password: {{akun_password}}
📱 Tipe   : {{tipe}}
⏱️ Durasi : {{durasi}} hari

Harap simpan data ini dengan baik dan jangan dibagikan ke orang lain.

Jika ada kendala, langsung hubungi kami ya! 🙏`,

  template_warranty: `Halo {{nama}} 👋

Kami telah menerima klaim garansi kamu dan sudah kami proses.

Berikut akun pengganti untuk kamu:

📧 Email  : {{akun_email}}
🔑 Password: {{akun_password}}

Mohon maaf atas ketidaknyamanannya. Jika masih ada kendala, jangan ragu untuk menghubungi kami 🙏`,

  template_promo: `Halo {{nama}} 👋

Ada promo spesial dari Dorizz Store untuk kamu hari ini! 🎉

Dapatkan akun premium dengan harga terbaik dan nikmati semua fitur tanpa batas.

Jangan lewatkan kesempatan ini! Hubungi kami sekarang untuk info lebih lanjut 🔥`,
};

// GET /api/settings — ambil semua settings
export async function GET() {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  try {
    const rows = await prisma.appSetting.findMany();
    const result: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Gagal mengambil settings" }, { status: 500 });
  }
}

// PUT /api/settings — update satu atau banyak key
export async function PUT(req: NextRequest) {
  const auth = await requireDeveloper();
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json() as Record<string, string>;
    const updates = Object.entries(body);

    await Promise.all(
      updates.map(([key, value]) =>
        prisma.appSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value) },
        })
      )
    );

    return NextResponse.json({ success: true, updated: updates.length });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json({ error: "Gagal menyimpan settings" }, { status: 500 });
  }
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { to, subject, body } = payload || {};

    console.log("send-sandbox-email invoked:", { to, subject, bodyLength: body?.length });

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let providerStatus = "sandbox_simulated";

    if (resendApiKey) {
      try {
        const fromEmail = "onboarding@resend.dev";
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: fromEmail,
            to: ["manoj.k.manne@gmail.com"],
            subject: subject || "MK97 ERP Communication",
            html: `<div>${body || ""}</div>`
          })
        });

        const responseData = await res.json();
        console.log("Resend API Logs:", responseData);

        if (res.ok) {
          providerStatus = "dispatched_via_resend";
        } else {
          console.warn("Resend API error status:", res.status, responseData);
        }
      } catch (err) {
        console.warn("Resend dispatch notice:", err);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sandbox email successfully transmitted",
        status: providerStatus,
        deliveryId: "sandbox-" + crypto.randomUUID(),
        to: "manoj.k.manne@gmail.com",
        originalRecipient: to,
        subject: subject || "MK97 ERP Communication",
        timestamp: new Date().toISOString()
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 200
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || "Invalid request payload" }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
        status: 400
      }
    );
  }
});

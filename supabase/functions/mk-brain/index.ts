import { createClient } from 'npm:@supabase/supabase-js@2';
import { createAIHandler } from './agent.mjs';

const adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}').default || '';
const admin = createClient(Deno.env.get('SUPABASE_URL') || '', adminKey, { auth: { persistSession: false, autoRefreshToken: false } });
const handler = createAIHandler({
  apiKey: Deno.env.get('OPENAI_API_KEY') || '',
  model: Deno.env.get('MK_AI_MODEL') || 'gpt-6-astra',
  allowedOrigins: (Deno.env.get('MK_AI_ALLOWED_ORIGINS') || 'https://mmk97-97.github.io').split(',').map(value => value.trim()).filter(Boolean),
  authorize: async (token: string, organization: string) => {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return null;
    const member = await admin.from('organization_members').select('role').eq('organization_id', organization).eq('user_id', data.user.id).maybeSingle();
    if (member.error || !member.data) return null;
    return { id: data.user.id };
  },
  claim: async (organization: string, user: string, request: string) => {
    const { data, error } = await admin.rpc('mk_claim_ai_request', { p_organization: organization, p_user: user, p_request: request });
    if (error) throw new Error('The server AI quota migration needs configuration.');
    return data;
  },
  finish: async (request: string, status: string, metrics: Record<string, unknown>) => {
    const { error } = await admin.from('mk_ai_requests').update({ status, completed_at: new Date().toISOString(), metrics }).eq('id', request);
    if (error) throw new Error('AI analysis could not be recorded.');
  }
});
Deno.serve(handler);

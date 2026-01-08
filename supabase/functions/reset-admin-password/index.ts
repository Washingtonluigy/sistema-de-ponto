import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: users } = await supabase.auth.admin.listUsers();
    const adminUser = users?.users.find(u => u.email === 'adminsolar@gmail.com');

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: 'Admin user not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      adminUser.id,
      {
        password: 'solar2025',
        email_confirm: true,
      }
    );

    if (updateError) {
      console.error('Update error:', updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: adminUser.id,
        full_name: 'Administrador Solar',
        phone: '',
        role: 'admin',
        job_position: 'Administrador do Sistema',
        work_hours: 8,
        updated_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Profile error:', profileError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Senha do admin atualizada com sucesso!',
        userId: adminUser.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
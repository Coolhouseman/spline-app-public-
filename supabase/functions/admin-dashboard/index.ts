import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verifyAdmin(authHeader: string | null): Promise<{ user: any; error: string | null }> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { user: null, error: "No authorization header" };
  }

  const token = authHeader.replace("Bearer ", "");
  
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !userData?.user) {
    return { user: null, error: "Invalid token" };
  }

  const { data: adminRole } = await supabaseAdmin
    .from("admin_roles")
    .select("*")
    .eq("email", userData.user.email)
    .single();

  if (!adminRole) {
    return { user: null, error: "Not an admin" };
  }

  return { user: { ...userData.user, role: adminRole.role, name: adminRole.name }, error: null };
}

async function handleLogin(body: any): Promise<Response> {
  const { email, password } = body;

  if (!email || !password) {
    return new Response(JSON.stringify({ success: false, error: "Email and password required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data: adminRole } = await supabaseAdmin
    .from("admin_roles")
    .select("*")
    .eq("email", email.toLowerCase())
    .single();

  if (!adminRole) {
    return new Response(JSON.stringify({ success: false, error: "Not authorized as admin" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
    email,
    password
  });

  if (authError || !authData.session) {
    return new Response(JSON.stringify({ success: false, error: authError?.message || "Authentication failed" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({
    success: true,
    session: {
      access_token: authData.session.access_token,
      expires_at: authData.session.expires_at
    },
    user: {
      id: authData.user.id,
      email: authData.user.email,
      role: adminRole.role,
      name: adminRole.name
    }
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleLogout(authHeader: string | null): Promise<Response> {
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      if (userData?.user?.id) {
        const revokeMethod = (supabaseAdmin.auth.admin as any).invalidateRefreshTokens;
        if (typeof revokeMethod === "function") {
          await revokeMethod.call(supabaseAdmin.auth.admin, userData.user.id);
        }
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleMetrics(authHeader: string | null): Promise<Response> {
  const { user, error } = await verifyAdmin(authHeader);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data, error: rpcError } = await supabaseAdmin.rpc("get_admin_dashboard_metrics");
  if (rpcError) {
    return new Response(JSON.stringify({ error: rpcError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify(data || {}), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleBuffer(authHeader: string | null): Promise<Response> {
  const { user, error } = await verifyAdmin(authHeader);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data, error: rpcError } = await supabaseAdmin.rpc("get_buffer_analysis");
  if (rpcError) {
    return new Response(JSON.stringify({ error: rpcError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify(data || {}), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleTrends(authHeader: string | null): Promise<Response> {
  const { user, error } = await verifyAdmin(authHeader);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data, error: rpcError } = await supabaseAdmin.rpc("get_transaction_trends");
  if (rpcError) {
    return new Response(JSON.stringify({ error: rpcError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify(data || []), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleTransactions(authHeader: string | null, url: URL): Promise<Response> {
  const { user, error } = await verifyAdmin(authHeader);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const type = url.searchParams.get("type") || null;
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = supabaseAdmin
    .from("wallet_transactions")
    .select("*, users!wallet_transactions_user_id_fkey(email, first_name, last_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) {
    query = query.eq("type", type);
  }

  const { data, count, error: queryError } = await query;
  if (queryError) {
    return new Response(JSON.stringify({ error: queryError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ transactions: data || [], total: count || 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleAdmins(authHeader: string | null): Promise<Response> {
  const { user, error } = await verifyAdmin(authHeader);
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { data, error: queryError } = await supabaseAdmin
    .from("admin_roles")
    .select("*")
    .order("created_at", { ascending: false });

  if (queryError) {
    return new Response(JSON.stringify({ error: queryError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify(data || []), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleAddAdmin(authHeader: string | null, body: any): Promise<Response> {
  const { user, error } = await verifyAdmin(authHeader);
  if (error || user?.role !== "super_admin") {
    return new Response(JSON.stringify({ error: "Super admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { email, name } = body;
  if (!email) {
    return new Response(JSON.stringify({ error: "Email required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { error: insertError } = await supabaseAdmin
    .from("admin_roles")
    .insert({ email: email.toLowerCase(), name: name || null, role: "admin" });

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function handleRemoveAdmin(authHeader: string | null, body: any): Promise<Response> {
  const { user, error } = await verifyAdmin(authHeader);
  if (error || user?.role !== "super_admin") {
    return new Response(JSON.stringify({ error: "Super admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { email } = body;
  if (!email || email.toLowerCase() === user.email?.toLowerCase()) {
    return new Response(JSON.stringify({ error: "Cannot remove yourself" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("admin_roles")
    .delete()
    .eq("email", email.toLowerCase());

  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function getAdminDashboardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spline Admin Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    .status-healthy { background-color: #10B981; }
    .status-warning { background-color: #F59E0B; }
    .status-critical { background-color: #EF4444; }
    .glass-card { background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.2); }
    body { background: linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #60a5fa 100%); min-height: 100vh; }
    .tab-active { background-color: #2563EB; color: white; }
    .loading-spinner { border: 3px solid #f3f3f3; border-top: 3px solid #2563EB; border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body class="font-sans">
  <div id="login-screen" class="min-h-screen flex items-center justify-center p-4">
    <div class="glass-card rounded-2xl p-8 w-full max-w-md shadow-2xl">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-800">Spline Admin</h1>
        <p class="text-gray-600 mt-2">Business Management Dashboard</p>
      </div>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
          <input type="email" id="admin-email" placeholder="admin@spline.nz" class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input type="password" id="admin-password" placeholder="Enter your password" class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
        </div>
        <button onclick="login()" id="login-btn" class="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
          <span>Sign In</span>
        </button>
        <p id="login-error" class="text-red-500 text-sm text-center hidden"></p>
      </div>
      <p class="text-xs text-gray-500 text-center mt-6">Sign in with your Supabase account. Only authorized admin emails can access.</p>
    </div>
  </div>

  <div id="dashboard" class="hidden">
    <nav class="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <h1 class="text-xl font-bold text-blue-600">Spline Admin</h1>
          <span id="admin-name" class="text-sm text-gray-500"></span>
        </div>
        <div class="flex items-center gap-4">
          <span id="last-updated" class="text-xs text-gray-400"></span>
          <button onclick="refreshData()" class="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
            Refresh
          </button>
          <button onclick="logout()" class="text-gray-500 hover:text-gray-700 text-sm">Logout</button>
        </div>
      </div>
    </nav>

    <div class="max-w-7xl mx-auto px-4 py-6">
      <div class="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button onclick="showTab('overview')" id="tab-overview" class="tab-active px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap">Overview</button>
        <button onclick="showTab('buffer')" id="tab-buffer" class="px-4 py-2 rounded-lg text-sm font-medium bg-white/80 whitespace-nowrap">Buffer Analysis</button>
        <button onclick="showTab('transactions')" id="tab-transactions" class="px-4 py-2 rounded-lg text-sm font-medium bg-white/80 whitespace-nowrap">Transactions</button>
        <button onclick="showTab('settings')" id="tab-settings" class="px-4 py-2 rounded-lg text-sm font-medium bg-white/80 whitespace-nowrap">Settings</button>
      </div>

      <div id="content-overview">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div class="glass-card rounded-xl p-5">
            <p class="text-sm text-gray-500">Total Wallet Liabilities</p>
            <p id="metric-liabilities" class="text-2xl font-bold text-gray-800 mt-1">$0.00</p>
            <p class="text-xs text-gray-400 mt-1">What we owe users</p>
          </div>
          <div class="glass-card rounded-xl p-5">
            <p class="text-sm text-gray-500">Total Deposits</p>
            <p id="metric-deposits" class="text-2xl font-bold text-green-600 mt-1">$0.00</p>
            <p class="text-xs text-gray-400 mt-1">All time</p>
          </div>
          <div class="glass-card rounded-xl p-5">
            <p class="text-sm text-gray-500">Total Withdrawals</p>
            <p id="metric-withdrawals" class="text-2xl font-bold text-red-600 mt-1">$0.00</p>
            <p class="text-xs text-gray-400 mt-1">All time</p>
          </div>
          <div class="glass-card rounded-xl p-5">
            <p class="text-sm text-gray-500">Active Wallets</p>
            <p id="metric-wallets" class="text-2xl font-bold text-blue-600 mt-1">0</p>
            <p class="text-xs text-gray-400 mt-1">With balance > $0</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div class="glass-card rounded-xl p-5">
            <p class="text-sm text-gray-500">BlinkPay Fees Absorbed</p>
            <p id="metric-blinkpay-fees" class="text-2xl font-bold text-orange-600 mt-1">$0.00</p>
            <p class="text-xs text-gray-400 mt-1">0.1% of deposits (our cost)</p>
          </div>
          <div class="glass-card rounded-xl p-5">
            <p class="text-sm text-gray-500">Fast Withdrawal Revenue</p>
            <p id="metric-fast-fees" class="text-2xl font-bold text-green-600 mt-1">$0.00</p>
            <p class="text-xs text-gray-400 mt-1">2% fee on fast transfers</p>
          </div>
          <div class="glass-card rounded-xl p-5">
            <p class="text-sm text-gray-500">Net Fee Position</p>
            <p id="metric-net-fees" class="text-2xl font-bold mt-1">$0.00</p>
            <p class="text-xs text-gray-400 mt-1">Revenue - Costs</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div class="glass-card rounded-xl p-5">
            <h3 class="font-semibold text-gray-800 mb-4">Activity (Last 7 Days)</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-green-50 rounded-lg p-3">
                <p class="text-xs text-green-600">Deposits</p>
                <p id="metric-deposits-7d" class="text-xl font-bold text-green-700">$0.00</p>
              </div>
              <div class="bg-red-50 rounded-lg p-3">
                <p class="text-xs text-red-600">Withdrawals</p>
                <p id="metric-withdrawals-7d" class="text-xl font-bold text-red-700">$0.00</p>
              </div>
            </div>
          </div>
          <div class="glass-card rounded-xl p-5">
            <h3 class="font-semibold text-gray-800 mb-4">Activity (Last 30 Days)</h3>
            <div class="grid grid-cols-2 gap-4">
              <div class="bg-green-50 rounded-lg p-3">
                <p class="text-xs text-green-600">Deposits</p>
                <p id="metric-deposits-30d" class="text-xl font-bold text-green-700">$0.00</p>
              </div>
              <div class="bg-red-50 rounded-lg p-3">
                <p class="text-xs text-red-600">Withdrawals</p>
                <p id="metric-withdrawals-30d" class="text-xl font-bold text-red-700">$0.00</p>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-card rounded-xl p-5">
          <h3 class="font-semibold text-gray-800 mb-4">Transaction Trends (30 Days)</h3>
          <div style="height: 300px;"><canvas id="trends-chart"></canvas></div>
        </div>
      </div>

      <div id="content-buffer" class="hidden">
        <div class="glass-card rounded-xl p-6 mb-6">
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-xl font-bold text-gray-800">Buffer/Cushion Status</h3>
            <div id="buffer-status-badge" class="px-4 py-2 rounded-full text-white font-semibold text-sm">Loading...</div>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="bg-blue-50 rounded-lg p-4">
              <p class="text-xs text-blue-600">Total Wallet Liabilities</p>
              <p id="buffer-liabilities" class="text-xl font-bold text-blue-800">$0.00</p>
            </div>
            <div class="bg-green-50 rounded-lg p-4">
              <p class="text-xs text-green-600">Net Cash Position</p>
              <p id="buffer-cash" class="text-xl font-bold text-green-800">$0.00</p>
            </div>
            <div class="bg-orange-50 rounded-lg p-4">
              <p class="text-xs text-orange-600">BlinkPay Fees Paid</p>
              <p id="buffer-blinkpay" class="text-xl font-bold text-orange-800">$0.00</p>
            </div>
            <div class="bg-purple-50 rounded-lg p-4">
              <p class="text-xs text-purple-600">Fast Fee Revenue</p>
              <p id="buffer-fast-fees" class="text-xl font-bold text-purple-800">$0.00</p>
            </div>
          </div>

          <div class="bg-gray-50 rounded-xl p-6 mb-6">
            <h4 class="font-semibold text-gray-700 mb-4">Buffer Requirement Calculator</h4>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div class="text-center">
                <p class="text-sm text-gray-500">Current Buffer Required</p>
                <p id="buffer-required" class="text-3xl font-bold text-gray-800 mt-2">$0.00</p>
              </div>
              <div class="text-center">
                <p class="text-sm text-gray-500">7-Day Projection</p>
                <p id="buffer-7d" class="text-3xl font-bold text-gray-800 mt-2">$0.00</p>
              </div>
              <div class="text-center">
                <p class="text-sm text-gray-500">30-Day Projection</p>
                <p id="buffer-30d" class="text-3xl font-bold text-gray-800 mt-2">$0.00</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div id="content-transactions" class="hidden">
        <div class="glass-card rounded-xl p-5 mb-6">
          <div class="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h3 class="font-semibold text-gray-800">Transaction History</h3>
            <div class="flex gap-2">
              <select id="tx-filter" onchange="loadTransactions()" class="px-3 py-2 rounded-lg border border-gray-300 text-sm">
                <option value="">All Types</option>
                <option value="deposit">Deposits</option>
                <option value="withdrawal">Withdrawals</option>
                <option value="split_payment">Split Payments</option>
                <option value="split_received">Split Received</option>
              </select>
            </div>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="text-left text-gray-500 border-b">
                  <th class="pb-3 pr-4">Date</th>
                  <th class="pb-3 pr-4">User</th>
                  <th class="pb-3 pr-4">Type</th>
                  <th class="pb-3 pr-4">Amount</th>
                  <th class="pb-3">Description</th>
                </tr>
              </thead>
              <tbody id="transactions-table">
                <tr><td colspan="5" class="py-8 text-center text-gray-400">Loading...</td></tr>
              </tbody>
            </table>
          </div>
          
          <div class="flex items-center justify-between mt-4 pt-4 border-t">
            <p id="tx-count" class="text-sm text-gray-500">Showing 0 of 0 transactions</p>
            <div class="flex gap-2">
              <button onclick="prevPage()" id="btn-prev" class="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50" disabled>Previous</button>
              <button onclick="nextPage()" id="btn-next" class="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50" disabled>Next</button>
            </div>
          </div>
        </div>
      </div>

      <div id="content-settings" class="hidden">
        <div class="glass-card rounded-xl p-6 mb-6">
          <h3 class="font-semibold text-gray-800 mb-4">Admin Users</h3>
          <div id="admin-list" class="space-y-3 mb-4"><p class="text-gray-400">Loading...</p></div>
          
          <div class="border-t pt-4 mt-4">
            <h4 class="font-medium text-gray-700 mb-3">Add New Admin</h4>
            <div class="flex flex-wrap gap-2">
              <input type="email" id="new-admin-email" placeholder="email@example.com" class="flex-1 min-w-48 px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <input type="text" id="new-admin-name" placeholder="Name (optional)" class="flex-1 min-w-32 px-3 py-2 rounded-lg border border-gray-300 text-sm">
              <button onclick="addAdmin()" class="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">Add Admin</button>
            </div>
          </div>
        </div>

        <div class="glass-card rounded-xl p-6">
          <h3 class="font-semibold text-gray-800 mb-4">Fee Configuration</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm text-gray-600">BlinkPay Fee Rate</p>
              <p class="text-xl font-bold text-gray-800">0.1%</p>
              <p class="text-xs text-gray-400">Charged on deposits</p>
            </div>
            <div class="bg-gray-50 rounded-lg p-4">
              <p class="text-sm text-gray-600">Fast Withdrawal Fee</p>
              <p class="text-xl font-bold text-gray-800">2%</p>
              <p class="text-xs text-gray-400">Included in withdrawal amount</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const API_BASE = '';
    let accessToken = '';
    let adminUser = null;
    let tokenExpiresAt = null;
    let currentPage = 0;
    let totalTransactions = 0;
    const PAGE_SIZE = 50;
    let trendsChart = null;
    
    function isTokenExpired() {
      if (!tokenExpiresAt) return true;
      return Date.now() > tokenExpiresAt * 1000 - 60000;
    }

    function formatCurrency(amount) {
      return new Intl.NumberFormat('en-NZ', { style: 'currency', currency: 'NZD' }).format(amount || 0);
    }

    function formatDate(dateStr) {
      return new Date(dateStr).toLocaleString('en-NZ', { dateStyle: 'medium', timeStyle: 'short' });
    }

    async function login() {
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;
      const loginBtn = document.getElementById('login-btn');
      const errorEl = document.getElementById('login-error');
      
      if (!email || !password) {
        errorEl.textContent = 'Please enter email and password';
        errorEl.classList.remove('hidden');
        return;
      }

      loginBtn.innerHTML = '<div class="loading-spinner"></div>';
      loginBtn.disabled = true;
      errorEl.classList.add('hidden');

      try {
        const res = await fetch(API_BASE + '/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success && data.session?.access_token) {
          accessToken = data.session.access_token;
          tokenExpiresAt = data.session.expires_at;
          adminUser = data.user;
          
          sessionStorage.setItem('adminAccessToken', accessToken);
          sessionStorage.setItem('adminUser', JSON.stringify(adminUser));
          sessionStorage.setItem('tokenExpiresAt', tokenExpiresAt.toString());
          
          document.getElementById('admin-name').textContent = adminUser.name || adminUser.email;
          document.getElementById('login-screen').classList.add('hidden');
          document.getElementById('dashboard').classList.remove('hidden');
          document.getElementById('admin-password').value = '';
          refreshData();
        } else {
          errorEl.textContent = data.error || 'Login failed';
          errorEl.classList.remove('hidden');
        }
      } catch (err) {
        errorEl.textContent = 'Connection error. Please try again.';
        errorEl.classList.remove('hidden');
      }

      loginBtn.innerHTML = '<span>Sign In</span>';
      loginBtn.disabled = false;
    }

    async function logout() {
      try {
        if (accessToken) {
          await fetch(API_BASE + '/logout', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + accessToken }
          });
        }
      } catch (err) {}
      
      accessToken = '';
      adminUser = null;
      tokenExpiresAt = null;
      sessionStorage.removeItem('adminAccessToken');
      sessionStorage.removeItem('adminUser');
      sessionStorage.removeItem('tokenExpiresAt');
      document.getElementById('dashboard').classList.add('hidden');
      document.getElementById('login-screen').classList.remove('hidden');
    }

    async function fetchWithAuth(endpoint) {
      if (!accessToken || isTokenExpired()) {
        await logout();
        throw new Error('Session expired');
      }
      
      const res = await fetch(API_BASE + endpoint, {
        headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' }
      });
      if (res.status === 401) {
        await logout();
        throw new Error('Session expired');
      }
      if (!res.ok) throw new Error('Request failed');
      return res.json();
    }

    function showTab(tab) {
      ['overview', 'buffer', 'transactions', 'settings'].forEach(t => {
        document.getElementById('content-' + t).classList.toggle('hidden', t !== tab);
        document.getElementById('tab-' + t).classList.toggle('tab-active', t === tab);
        document.getElementById('tab-' + t).classList.toggle('bg-white/80', t !== tab);
      });
    }

    async function refreshData() {
      document.getElementById('last-updated').textContent = 'Updating...';
      try {
        await Promise.all([loadMetrics(), loadBuffer(), loadTrends(), loadTransactions(), loadAdmins()]);
        document.getElementById('last-updated').textContent = 'Updated: ' + new Date().toLocaleTimeString();
      } catch (err) {
        document.getElementById('last-updated').textContent = 'Update failed';
      }
    }

    async function loadMetrics() {
      try {
        const data = await fetchWithAuth('/metrics');
        document.getElementById('metric-liabilities').textContent = formatCurrency(data.total_wallet_liabilities);
        document.getElementById('metric-deposits').textContent = formatCurrency(data.total_deposits);
        document.getElementById('metric-withdrawals').textContent = formatCurrency(data.total_withdrawals);
        document.getElementById('metric-wallets').textContent = data.active_wallet_count || 0;
        document.getElementById('metric-blinkpay-fees').textContent = formatCurrency(data.blinkpay_fees_absorbed);
        document.getElementById('metric-fast-fees').textContent = formatCurrency(data.fast_withdrawal_fee_revenue);
        
        const netFees = data.net_fee_position || 0;
        const netFeesEl = document.getElementById('metric-net-fees');
        netFeesEl.textContent = formatCurrency(netFees);
        netFeesEl.className = 'text-2xl font-bold mt-1 ' + (netFees >= 0 ? 'text-green-600' : 'text-red-600');
        
        document.getElementById('metric-deposits-7d').textContent = formatCurrency(data.deposits_7days);
        document.getElementById('metric-withdrawals-7d').textContent = formatCurrency(data.withdrawals_7days);
        document.getElementById('metric-deposits-30d').textContent = formatCurrency(data.deposits_30days);
        document.getElementById('metric-withdrawals-30d').textContent = formatCurrency(data.withdrawals_30days);
      } catch (err) {}
    }

    async function loadBuffer() {
      try {
        const data = await fetchWithAuth('/buffer');
        document.getElementById('buffer-liabilities').textContent = formatCurrency(data.total_wallet_liabilities);
        document.getElementById('buffer-cash').textContent = formatCurrency(data.net_cash_position);
        document.getElementById('buffer-blinkpay').textContent = formatCurrency(data.blinkpay_fees_paid);
        document.getElementById('buffer-fast-fees').textContent = formatCurrency(data.fast_fee_revenue);
        document.getElementById('buffer-required').textContent = formatCurrency(data.buffer_required);
        document.getElementById('buffer-7d').textContent = formatCurrency(data.buffer_7day_projection);
        document.getElementById('buffer-30d').textContent = formatCurrency(data.buffer_30day_projection);
        
        const badge = document.getElementById('buffer-status-badge');
        const bufferReq = data.buffer_required || 0;
        if (bufferReq <= 0) {
          badge.textContent = 'Healthy';
          badge.className = 'px-4 py-2 rounded-full text-white font-semibold text-sm status-healthy';
        } else if (bufferReq < 1000) {
          badge.textContent = 'Warning';
          badge.className = 'px-4 py-2 rounded-full text-white font-semibold text-sm status-warning';
        } else {
          badge.textContent = 'Critical';
          badge.className = 'px-4 py-2 rounded-full text-white font-semibold text-sm status-critical';
        }
      } catch (err) {}
    }

    async function loadTrends() {
      try {
        const data = await fetchWithAuth('/trends');
        const ctx = document.getElementById('trends-chart').getContext('2d');
        if (trendsChart) trendsChart.destroy();
        trendsChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: data.map(d => d.date),
            datasets: [
              { label: 'Deposits', data: data.map(d => d.deposits), borderColor: '#10B981', tension: 0.3 },
              { label: 'Withdrawals', data: data.map(d => d.withdrawals), borderColor: '#EF4444', tension: 0.3 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false }
        });
      } catch (err) {}
    }

    async function loadTransactions() {
      try {
        const filter = document.getElementById('tx-filter').value;
        const url = '/transactions?limit=' + PAGE_SIZE + '&offset=' + (currentPage * PAGE_SIZE) + (filter ? '&type=' + filter : '');
        const data = await fetchWithAuth(url);
        totalTransactions = data.total;
        
        const tbody = document.getElementById('transactions-table');
        if (!data.transactions?.length) {
          tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-400">No transactions found</td></tr>';
        } else {
          tbody.innerHTML = data.transactions.map(tx => {
            const user = tx.users || {};
            const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || 'Unknown';
            return '<tr class="border-b"><td class="py-3 pr-4">' + formatDate(tx.created_at) + '</td><td class="py-3 pr-4">' + userName + '</td><td class="py-3 pr-4"><span class="px-2 py-1 rounded text-xs ' + (tx.type === 'deposit' ? 'bg-green-100 text-green-700' : tx.type === 'withdrawal' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700') + '">' + tx.type + '</span></td><td class="py-3 pr-4 font-medium">' + formatCurrency(tx.amount) + '</td><td class="py-3 text-gray-500">' + (tx.description || '-') + '</td></tr>';
          }).join('');
        }
        
        document.getElementById('tx-count').textContent = 'Showing ' + Math.min((currentPage + 1) * PAGE_SIZE, totalTransactions) + ' of ' + totalTransactions;
        document.getElementById('btn-prev').disabled = currentPage === 0;
        document.getElementById('btn-next').disabled = (currentPage + 1) * PAGE_SIZE >= totalTransactions;
      } catch (err) {}
    }

    function prevPage() { if (currentPage > 0) { currentPage--; loadTransactions(); } }
    function nextPage() { if ((currentPage + 1) * PAGE_SIZE < totalTransactions) { currentPage++; loadTransactions(); } }

    async function loadAdmins() {
      try {
        const data = await fetchWithAuth('/admins');
        const list = document.getElementById('admin-list');
        if (!data?.length) {
          list.innerHTML = '<p class="text-gray-400">No admins found</p>';
        } else {
          list.innerHTML = data.map(a => '<div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg"><div><p class="font-medium">' + (a.name || a.email) + '</p><p class="text-xs text-gray-500">' + a.email + ' - ' + a.role + '</p></div>' + (adminUser?.role === 'super_admin' && a.email !== adminUser?.email ? '<button onclick="removeAdmin(\\'' + a.email + '\\')" class="text-red-500 text-sm hover:text-red-700">Remove</button>' : '') + '</div>').join('');
        }
      } catch (err) {}
    }

    async function addAdmin() {
      const email = document.getElementById('new-admin-email').value.trim();
      const name = document.getElementById('new-admin-name').value.trim();
      if (!email) return alert('Please enter an email');
      
      try {
        const res = await fetch(API_BASE + '/admins/add', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name })
        });
        const data = await res.json();
        if (data.success) {
          document.getElementById('new-admin-email').value = '';
          document.getElementById('new-admin-name').value = '';
          loadAdmins();
        } else {
          alert(data.error || 'Failed to add admin');
        }
      } catch (err) {
        alert('Error adding admin');
      }
    }

    async function removeAdmin(email) {
      if (!confirm('Remove admin access for ' + email + '?')) return;
      
      try {
        const res = await fetch(API_BASE + '/admins/remove', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (data.success) loadAdmins();
        else alert(data.error || 'Failed to remove admin');
      } catch (err) {
        alert('Error removing admin');
      }
    }

    window.onload = function() {
      const savedToken = sessionStorage.getItem('adminAccessToken');
      const savedUser = sessionStorage.getItem('adminUser');
      const savedExpiry = sessionStorage.getItem('tokenExpiresAt');
      
      if (savedToken && savedUser && savedExpiry) {
        accessToken = savedToken;
        adminUser = JSON.parse(savedUser);
        tokenExpiresAt = parseInt(savedExpiry);
        
        if (!isTokenExpired()) {
          document.getElementById('admin-name').textContent = adminUser.name || adminUser.email;
          document.getElementById('login-screen').classList.add('hidden');
          document.getElementById('dashboard').classList.remove('hidden');
          refreshData();
        } else {
          logout();
        }
      }
    };
  </script>
</body>
</html>`;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/admin-dashboard/, "");
  const method = req.method;
  const authHeader = req.headers.get("authorization");

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (method === "GET" && (path === "" || path === "/")) {
      return new Response(getAdminDashboardHTML(), {
        headers: { ...corsHeaders, "Content-Type": "text/html" }
      });
    }

    if (method === "POST" && path === "/login") {
      const body = await req.json();
      return handleLogin(body);
    }

    if (method === "POST" && path === "/logout") {
      return handleLogout(authHeader);
    }

    if (method === "GET" && path === "/metrics") {
      return handleMetrics(authHeader);
    }

    if (method === "GET" && path === "/buffer") {
      return handleBuffer(authHeader);
    }

    if (method === "GET" && path === "/trends") {
      return handleTrends(authHeader);
    }

    if (method === "GET" && path === "/transactions") {
      return handleTransactions(authHeader, url);
    }

    if (method === "GET" && path === "/admins") {
      return handleAdmins(authHeader);
    }

    if (method === "POST" && path === "/admins/add") {
      const body = await req.json();
      return handleAddAdmin(authHeader, body);
    }

    if (method === "POST" && path === "/admins/remove") {
      const body = await req.json();
      return handleRemoveAdmin(authHeader, body);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    console.error("Admin dashboard error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

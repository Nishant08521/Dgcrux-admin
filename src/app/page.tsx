"use client"

import { useState, useEffect } from "react"
import { Search, LayoutDashboard, GraduationCap, Mail, PhoneCall, LogOut, Download, RefreshCw, FileText, BadgeCheck, Upload } from "lucide-react"

const API = process.env.NEXT_PUBLIC_BACKEND_URL?.trim().replace(/\/$/, "") || ""
const ADMIN_KEY = "dgcrux-admin-2026"

const buildApiUrl = (endpoint: string) => {
  if (!API) throw new Error("Missing NEXT_PUBLIC_BACKEND_URL")
  return `${API}${endpoint}`
}

export default function AdminDashboard() {
  const [adminKey, setAdminKey] = useState("")
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loginError, setLoginError] = useState("")
  
  const [activeTab, setActiveTab] = useState("dashboard")
  const [stats, setStats] = useState({ total: 0, internship: 0, contact: 0, bookcall: 0, certificates: 0 })
  const [data, setData] = useState<{ internship: any[], contact: any[], bookcall: any[], certificates: any[] }>({ internship: [], contact: [], bookcall: [], certificates: [] })
  const [searchQuery, setSearchQuery] = useState("")

  // Certificate Upload State
  const [certForm, setCertForm] = useState({ name: "", course: "", issueDate: "", certificateNumber: "", dob: "" })
  const [certFile, setCertFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [toast, setToast] = useState<{msg: string, type: string} | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // -- Helpers --
  const showToast = (msg: string, type = "success") => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const fmtDate = (iso: string) => {
    if (!iso) return "—"
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  }

  // -- API Calls --
  const apiFetch = async (endpoint: string) => {
    const res = await fetch(buildApiUrl(endpoint), { headers: { "x-admin-key": adminKey } })
    if (res.status === 401) throw new Error("Unauthorized")
    return res.json()
  }

  const loadData = async () => {
    if (!adminKey) return
    setIsLoading(true)
    try {
      // Fetch stats first so totals are shown even if one of the list endpoints fails
      const statsRes = await apiFetch("/api/admin/stats")
      // Ensure stats have numeric fallbacks
      const computedFallback = {
        internship: Array.isArray(statsRes?.internship) ? statsRes.internship.length : statsRes?.internship ?? 0,
        contact: Array.isArray(statsRes?.contact) ? statsRes.contact.length : statsRes?.contact ?? 0,
        bookcall: Array.isArray(statsRes?.bookcall) ? statsRes.bookcall.length : statsRes?.bookcall ?? 0,
        certificates: Array.isArray(statsRes?.certificates) ? statsRes.certificates.length : statsRes?.certificates ?? 0,
      }
      const totalFallback = (typeof statsRes?.total === "number") ? statsRes.total : (computedFallback.internship + computedFallback.contact + computedFallback.bookcall + computedFallback.certificates)
      setStats({
        internship: Number(statsRes?.internship ?? computedFallback.internship) || computedFallback.internship,
        contact: Number(statsRes?.contact ?? computedFallback.contact) || computedFallback.contact,
        bookcall: Number(statsRes?.bookcall ?? computedFallback.bookcall) || computedFallback.bookcall,
        certificates: Number(statsRes?.certificates ?? computedFallback.certificates) || computedFallback.certificates,
        total: Number(statsRes?.total ?? totalFallback) || totalFallback,
      })

      // Fetch lists; tolerate failures so stats remain visible
      const results = await Promise.allSettled([
        apiFetch("/api/admin/internship"),
        apiFetch("/api/admin/contact"),
        apiFetch("/api/admin/bookcall"),
        apiFetch("/api/admin/certificates")
      ])

      const internRes = results[0].status === "fulfilled" ? results[0].value : []
      const contactRes = results[1].status === "fulfilled" ? results[1].value : []
      const bookRes = results[2].status === "fulfilled" ? results[2].value : []
      const certRes = results[3].status === "fulfilled" ? results[3].value : []

      setData({ internship: internRes, contact: contactRes, bookcall: bookRes, certificates: certRes })

      // If any stats were missing or zero, derive from list lengths so UI shows counts
      const derived = {
        internship: Array.isArray(internRes) ? internRes.length : 0,
        contact: Array.isArray(contactRes) ? contactRes.length : 0,
        bookcall: Array.isArray(bookRes) ? bookRes.length : 0,
        certificates: Array.isArray(certRes) ? certRes.length : 0,
      }
      const derivedTotal = derived.internship + derived.contact + derived.bookcall + derived.certificates

      setStats(s => ({
        internship: s.internship || derived.internship,
        contact: s.contact || derived.contact,
        bookcall: s.bookcall || derived.bookcall,
        certificates: s.certificates || derived.certificates,
        total: s.total || derivedTotal,
      }))
    } catch (err) {
      console.error(err)
      if (err instanceof Error && err.message === "Unauthorized") {
        setIsLoggedIn(false)
        setLoginError("Session expired")
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      loadData()
      const interval = setInterval(loadData, 60000)
      return () => clearInterval(interval)
    }
  }, [isLoggedIn, adminKey])

  // -- Upload Certificate --
  const handleUploadCert = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!certFile) return showToast("Please select an image file", "error")
    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append("name", certForm.name)
      formData.append("course", certForm.course)
      formData.append("issueDate", certForm.issueDate)
      formData.append("certificateNumber", certForm.certificateNumber)
      if (certForm.dob) formData.append("dob", certForm.dob)
      formData.append("image", certFile)

      const res = await fetch(buildApiUrl("/api/admin/certificates"), {
        method: "POST",
        headers: { "x-admin-key": adminKey },
        body: formData
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Upload failed")
      
      showToast("Certificate uploaded successfully")
      setCertForm({ name: "", course: "", issueDate: "", certificateNumber: "", dob: "" })
      setCertFile(null)
      loadData()
      setActiveTab("certificates_list")
    } catch (err: any) {
      showToast(err.message, "error")
    } finally {
      setIsUploading(false)
    }
  }

  // -- Login / Logout --
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError("")
    try {
      const res = await fetch(buildApiUrl("/api/admin/stats"), { headers: { "x-admin-key": adminKey } })
      if (res.status === 401) throw new Error("Invalid key")
      setIsLoggedIn(true)
    } catch {
      setLoginError("Invalid admin key. Please try again.")
    }
  }

  const handleLogout = () => {
    setAdminKey("")
    setIsLoggedIn(false)
  }

  // -- Export --
  const exportCSV = (type: "internship" | "contact" | "bookcall" | "certificates_list") => {
    const listType = type === "certificates_list" ? "certificates" : type;
    const items = data[listType]
    if (!items || !items.length) {
      showToast("No data to export", "error")
      return
    }

    const headers = {
      internship: ["id", "fullName", "email", "phone", "course", "duration", "mode", "submittedAt"],
      contact: ["id", "fullName", "businessEmail", "contactNumber", "projectDescription", "submittedAt"],
      bookcall: ["id", "name", "companyEmail", "contactNumber", "workEmail", "projectDescription", "submittedAt"],
      certificates_list: ["id", "certificateNumber", "name", "course", "issueDate", "dob", "uploadedAt"]
    }[type]

    const rows = [headers, ...items.map((r: any) => headers?.map(h => JSON.stringify(r[h] ?? "")))]
    const csv = rows.map(r => r.join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `dgcrux-${type}-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast(`Exported ${items.length} records`)
  }

  // -- Delete Record --
  const handleDelete = async (type: "internship" | "contact" | "bookcall" | "certificates_list", id: any) => {
    const listType = type === "certificates_list" ? "certificates" : type;
    if (!id) return showToast("Invalid record id", "error")
    if (!confirm("Delete this record? This action cannot be undone.")) return
    try {
      const res = await fetch(buildApiUrl(`/api/admin/${listType}/${id}`), { method: "DELETE", headers: { "x-admin-key": adminKey } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Delete failed")
      showToast("Record deleted")
      loadData()
    } catch (err: any) {
      showToast(err.message || "Delete failed", "error")
    }
  }

  // -- Filters --
  const getFilteredData = (type: "internship" | "contact" | "bookcall" | "certificates_list") => {
    const listType = type === "certificates_list" ? "certificates" : type;
    const items = data[listType]
    if (!Array.isArray(items)) return []
    if (!searchQuery) return items
    const q = searchQuery.toLowerCase()
    
    if (type === "internship") {
      return items.filter(r => [r.fullName, r.email, r.phone, r.course, r.mode].some(v => String(v||"").toLowerCase().includes(q)))
    }
    if (type === "contact") {
      return items.filter(r => [r.fullName, r.businessEmail, r.contactNumber].some(v => String(v||"").toLowerCase().includes(q)))
    }
    if (type === "bookcall") {
      return items.filter(r => [r.name, r.companyEmail, r.contactNumber].some(v => String(v||"").toLowerCase().includes(q)))
    }
    if (type === "certificates_list") {
      return items.filter(r => [r.name, r.certificateNumber, r.course].some(v => String(v||"").toLowerCase().includes(q)))
    }
    return items
  }

  // == RENDER ==
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0d0f1a] flex items-center justify-center p-4" style={{ background: "radial-gradient(ellipse at 60% 40%, #1a1540 0%, #0d0f1a 70%)" }}>
        <div className="bg-[#151726] border border-white/10 rounded-2xl p-10 w-full max-w-md shadow-2xl text-center">
          <div className="text-3xl font-extrabold tracking-tight mb-2 text-white">Dg<span className="text-orange-500">Crux</span> Admin</div>
          <p className="text-slate-400 text-sm mb-8">Enter your admin key to access the dashboard</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="text-left">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Admin Key</label>
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                className="w-full bg-[#1c1f35] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="••••••••••••••••"
              />
            </div>
            {loginError && <p className="text-red-400 text-xs text-left">{loginError}</p>}
            <button type="submit" className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3 rounded-lg transition-all">
              Sign In
            </button>
          </form>
        </div>
      </div>
    )
  }

  // Dashboard Recent Data Compilation
  const recentData = [
    ...(Array.isArray(data.internship) ? data.internship.map(r => ({ ...r, _type: "Internship", _name: r.fullName, _email: r.email, _color: "orange" })) : []),
    ...(Array.isArray(data.contact) ? data.contact.map(r => ({ ...r, _type: "Contact Us", _name: r.fullName, _email: r.businessEmail, _color: "red" })) : []),
    ...(Array.isArray(data.bookcall) ? data.bookcall.map(r => ({ ...r, _type: "Book a Call", _name: r.name, _email: r.companyEmail, _color: "green" })) : []),
  ].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()).slice(0, 10)

  return (
    <div className="min-h-screen bg-[#0d0f1a] text-slate-200 flex font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#151726] border-r border-white/5 flex flex-col shrink-0">
        <div className="p-6 pb-8">
          <div className="text-2xl font-extrabold tracking-tight text-white">Dg<span className="text-orange-500">Crux</span></div>
        </div>
        
        <div className="px-4 pb-4">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2 mb-3">Navigation</p>
          <nav className="space-y-1">
            <button onClick={() => {setActiveTab("dashboard"); setSearchQuery("")}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTab === "dashboard" ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard
            </button>
            <button onClick={() => {setActiveTab("internship"); setSearchQuery("")}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors justify-between ${activeTab === "internship" ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <div className="flex items-center gap-3"><GraduationCap className="w-4 h-4" /> Internship</div>
              <span className="bg-[#1c1f35] px-2 py-0.5 rounded-full text-[10px]">{stats.internship}</span>
            </button>
            <button onClick={() => {setActiveTab("contact"); setSearchQuery("")}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors justify-between ${activeTab === "contact" ? "bg-red-500/10 text-red-400 border border-red-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <div className="flex items-center gap-3"><Mail className="w-4 h-4" /> Contact Us</div>
              <span className="bg-[#1c1f35] px-2 py-0.5 rounded-full text-[10px]">{stats.contact}</span>
            </button>
            <button onClick={() => {setActiveTab("bookcall"); setSearchQuery("")}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors justify-between ${activeTab === "bookcall" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
              <div className="flex items-center gap-3"><PhoneCall className="w-4 h-4" /> Book a Call</div>
              <span className="bg-[#1c1f35] px-2 py-0.5 rounded-full text-[10px]">{stats.bookcall}</span>
            </button>
            <div className="pt-2 mt-2 border-t border-white/5">
              <button onClick={() => {setActiveTab("certificates"); setSearchQuery("")}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors justify-between ${activeTab === "certificates" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                <div className="flex items-center gap-3"><Upload className="w-4 h-4" /> Upload Certificate</div>
              </button>
              <button onClick={() => {setActiveTab("certificates_list"); setSearchQuery("")}} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors justify-between ${activeTab === "certificates_list" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>
                <div className="flex items-center gap-3"><BadgeCheck className="w-4 h-4" /> Certificates</div>
                <span className="bg-[#1c1f35] px-2 py-0.5 rounded-full text-[10px]">{stats.certificates}</span>
              </button>
            </div>
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="bg-[#1c1f35] rounded-xl p-4">
            <p className="text-white text-sm font-bold">Admin Session</p>
            <p className="text-slate-500 text-xs mt-1 truncate">localhost:4000</p>
            <button onClick={handleLogout} className="mt-3 w-full flex items-center justify-center gap-2 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Header */}
        <header className="h-20 border-b border-white/5 px-8 flex items-center justify-between shrink-0 bg-[#0d0f1a]/80 backdrop-blur-md z-10">
          <div>
            <h1 className="text-xl font-bold text-white capitalize">
              {activeTab === "dashboard" ? "Overview" : 
               activeTab === "bookcall" ? "Book a Free Call" : 
               activeTab === "certificates" ? "Upload New Certificate" : 
               activeTab === "certificates_list" ? "Verified Certificates" : 
               activeTab + " Submissions"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {activeTab !== "dashboard" && activeTab !== "certificates" && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Search records..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-[#151726] border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-indigo-500 w-64"
                />
              </div>
            )}
            <button onClick={loadData} disabled={isLoading} className="p-2.5 bg-[#151726] border border-white/10 hover:border-white/20 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            {activeTab !== "dashboard" && activeTab !== "certificates" && (
              <button onClick={() => exportCSV(activeTab as any)} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg text-sm font-bold transition-colors">
                <Download className="w-4 h-4" /> Export CSV
              </button>
            )}
          </div>
        </header>

        {/* Content Scroll */}
        <div className="flex-1 overflow-auto p-8">
          
          {/* Dashboard Tab */}
          {activeTab === "dashboard" && (
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-[#151726] border border-white/5 rounded-2xl p-6 flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center text-indigo-500 shrink-0"><FileText className="w-6 h-6" /></div>
                  <div>
                    <p className="text-3xl font-black text-white">{stats.total}</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Total Submissions</p>
                  </div>
                </div>
                <div className="bg-[#151726] border border-white/5 rounded-2xl p-6 flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-500 shrink-0"><GraduationCap className="w-6 h-6" /></div>
                  <div>
                    <p className="text-3xl font-black text-white">{stats.internship}</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Internship</p>
                  </div>
                </div>
                <div className="bg-[#151726] border border-white/5 rounded-2xl p-6 flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-red-500/15 flex items-center justify-center text-red-500 shrink-0"><Mail className="w-6 h-6" /></div>
                  <div>
                    <p className="text-3xl font-black text-white">{stats.contact}</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Contact Us</p>
                  </div>
                </div>
                <div className="bg-[#151726] border border-white/5 rounded-2xl p-6 flex items-center gap-5">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-500 shrink-0"><BadgeCheck className="w-6 h-6" /></div>
                  <div>
                    <p className="text-3xl font-black text-white">{stats.certificates}</p>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Certificates</p>
                  </div>
                </div>
              </div>

              {/* Recent Table */}
              <div className="bg-[#151726] border border-white/5 rounded-2xl overflow-hidden">
                <div className="px-6 py-5 border-b border-white/5">
                  <h3 className="font-bold text-white">Recent Activity</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-[#1c1f35] text-slate-400 text-[11px] uppercase tracking-widest">
                        <th className="px-6 py-3 font-semibold">Name</th>
                        <th className="px-6 py-3 font-semibold">Form Type</th>
                        <th className="px-6 py-3 font-semibold">Email</th>
                        <th className="px-6 py-3 font-semibold">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {recentData.length === 0 ? (
                        <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-500">No submissions yet</td></tr>
                      ) : recentData.map((row, i) => (
                        <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-6 py-4 font-medium text-white">{row._name}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                              row._color === "orange" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                              row._color === "red" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                              "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            }`}>
                              {row._type}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-400">{row._email}</td>
                          <td className="px-6 py-4 text-slate-500 text-xs">{fmtDate(row.submittedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Upload Certificate Form */}
          {activeTab === "certificates" && (
            <div className="max-w-3xl mx-auto bg-[#151726] border border-white/5 rounded-2xl p-8">
              <form onSubmit={handleUploadCert} className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Student Name *</label>
                    <input type="text" required value={certForm.name} onChange={e => setCertForm({...certForm, name: e.target.value})} className="w-full bg-[#1c1f35] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors" placeholder="e.g. Manish Raj" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Course *</label>
                    <input type="text" required value={certForm.course} onChange={e => setCertForm({...certForm, course: e.target.value})} className="w-full bg-[#1c1f35] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors" placeholder="e.g. Fundamentals of MERN Stack" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Issue Date *</label>
                    <input type="date" required value={certForm.issueDate} onChange={e => setCertForm({...certForm, issueDate: e.target.value})} className="w-full bg-[#1c1f35] border border-white/10 rounded-lg px-4 py-3 text-slate-300 focus:outline-none focus:border-purple-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Certificate Number *</label>
                    <input type="text" required value={certForm.certificateNumber} onChange={e => setCertForm({...certForm, certificateNumber: e.target.value})} className="w-full bg-[#1c1f35] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors" placeholder="e.g. DG/26/1038" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Date of Birth (Optional)</label>
                    <input type="text" value={certForm.dob} onChange={e => setCertForm({...certForm, dob: e.target.value})} className="w-full bg-[#1c1f35] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors" placeholder="dd-mm-yyyy" />
                  </div>
                  <div className="col-span-2 border-t border-white/5 pt-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Certificate Image *</label>
                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:bg-[#1c1f35] transition-colors relative">
                      <input type="file" required accept="image/*" onChange={e => setCertFile(e.target.files ? e.target.files[0] : null)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                      {certFile ? (
                        <div className="text-purple-400 font-medium">Selected: {certFile.name}</div>
                      ) : (
                        <div className="text-slate-500">
                          <Upload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p>Click or drag image to upload</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={isUploading} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50">
                  {isUploading ? "Uploading..." : "Save Certificate"}
                </button>
              </form>
            </div>
          )}

          {/* Tables */}
          {activeTab !== "dashboard" && activeTab !== "certificates" && (
            <div className="bg-[#151726] border border-white/5 rounded-2xl overflow-hidden max-w-7xl mx-auto">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-[#1c1f35] text-slate-400 text-[11px] uppercase tracking-widest">
                      {activeTab === "internship" && (
                        <>
                          <th className="px-6 py-4 font-semibold">Name</th>
                          <th className="px-6 py-4 font-semibold">Email</th>
                          <th className="px-6 py-4 font-semibold">Phone</th>
                          <th className="px-6 py-4 font-semibold">Course</th>
                          <th className="px-6 py-4 font-semibold">Mode</th>
                          <th className="px-6 py-4 font-semibold">Date</th>
                          <th className="px-6 py-4 font-semibold">Actions</th>
                        </>
                      )}
                      {activeTab === "contact" && (
                        <>
                          <th className="px-6 py-4 font-semibold">Name</th>
                          <th className="px-6 py-4 font-semibold">Business Email</th>
                          <th className="px-6 py-4 font-semibold">Phone</th>
                          <th className="px-6 py-4 font-semibold">Project Details</th>
                          <th className="px-6 py-4 font-semibold">Date</th>
                          <th className="px-6 py-4 font-semibold">Actions</th>
                        </>
                      )}
                      {activeTab === "bookcall" && (
                        <>
                          <th className="px-6 py-4 font-semibold">Name</th>
                          <th className="px-6 py-4 font-semibold">Company Email</th>
                          <th className="px-6 py-4 font-semibold">Phone</th>
                          <th className="px-6 py-4 font-semibold">Work Email</th>
                          <th className="px-6 py-4 font-semibold">Project Details</th>
                          <th className="px-6 py-4 font-semibold">Date</th>
                          <th className="px-6 py-4 font-semibold">Actions</th>
                        </>
                      )}
                      {activeTab === "certificates_list" && (
                        <>
                          <th className="px-6 py-4 font-semibold">Certificate No.</th>
                          <th className="px-6 py-4 font-semibold">Name</th>
                          <th className="px-6 py-4 font-semibold">Course</th>
                          <th className="px-6 py-4 font-semibold">Issue Date</th>
                          <th className="px-6 py-4 font-semibold">Image</th>
                          <th className="px-6 py-4 font-semibold">Uploaded</th>
                          <th className="px-6 py-4 font-semibold">Actions</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {getFilteredData(activeTab as any).length === 0 ? (
                      <tr><td colSpan={10} className="px-6 py-16 text-center text-slate-500">No records found</td></tr>
                    ) : getFilteredData(activeTab as any).map((row: any) => (
                      <tr key={row.id || row._id} className="hover:bg-white/[0.02] transition-colors">
                        {activeTab === "internship" && (
                          <>
                            <td className="px-6 py-4 font-medium text-white">{row.fullName}</td>
                            <td className="px-6 py-4 text-slate-400">{row.email}</td>
                            <td className="px-6 py-4 text-slate-400">{row.phone}</td>
                            <td className="px-6 py-4 text-slate-300">{row.course}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${row.mode === "Online" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"}`}>{row.mode}</span>
                            </td>
                            <td className="px-6 py-4 text-slate-500 text-xs">{fmtDate(row.submittedAt)}</td>
                          </>
                        )}
                        {activeTab === "contact" && (
                          <>
                            <td className="px-6 py-4 font-medium text-white">{row.fullName}</td>
                            <td className="px-6 py-4 text-slate-400">{row.businessEmail}</td>
                            <td className="px-6 py-4 text-slate-400">{row.contactNumber}</td>
                            <td className="px-6 py-4 text-slate-400 truncate max-w-[200px]" title={row.projectDescription}>{row.projectDescription || "—"}</td>
                            <td className="px-6 py-4 text-slate-500 text-xs">{fmtDate(row.submittedAt)}</td>
                          </>
                        )}
                        {activeTab === "bookcall" && (
                          <>
                            <td className="px-6 py-4 font-medium text-white">{row.name}</td>
                            <td className="px-6 py-4 text-slate-400">{row.companyEmail}</td>
                            <td className="px-6 py-4 text-slate-400">{row.contactNumber}</td>
                            <td className="px-6 py-4 text-slate-400">{row.workEmail || "—"}</td>
                            <td className="px-6 py-4 text-slate-400 truncate max-w-[150px]" title={row.projectDescription}>{row.projectDescription || "—"}</td>
                            <td className="px-6 py-4 text-slate-500 text-xs">{fmtDate(row.submittedAt)}</td>
                          </>
                        )}
                        {activeTab === "certificates_list" && (
                          <>
                            <td className="px-6 py-4 font-bold text-purple-400">{row.certificateNumber}</td>
                            <td className="px-6 py-4 text-white font-medium">{row.name}</td>
                            <td className="px-6 py-4 text-slate-300">{row.course}</td>
                            <td className="px-6 py-4 text-slate-400">{new Date(row.issueDate).toLocaleDateString()}</td>
                            <td className="px-6 py-4 text-slate-400">
                              <a href={buildApiUrl(row.imagePath)} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">View</a>
                            </td>
                            <td className="px-6 py-4 text-slate-500 text-xs">{fmtDate(row.uploadedAt)}</td>
                          </>
                        )}
                        <td className="px-6 py-4">
                          <button onClick={() => handleDelete(activeTab as any, row.id || row._id)} className="text-red-400 hover:underline text-sm">Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-3 border-t border-white/5 text-xs text-slate-500">
                Showing {getFilteredData(activeTab as any).length} records
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-2xl border font-medium text-sm flex items-center gap-2 animate-in slide-in-from-bottom-5 ${toast.type === "success" ? "bg-[#151726] border-emerald-500/30 text-emerald-400" : "bg-[#151726] border-red-500/30 text-red-400"}`}>
          {toast.type === "success" ? "✅" : "❌"} {toast.msg}
        </div>
      )}
    </div>
  )
}

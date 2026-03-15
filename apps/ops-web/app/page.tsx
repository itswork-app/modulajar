export default function DashboardPage() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-black tracking-tighter">Modulajar HQ</h1>
        <p className="text-slate-400 font-medium max-w-md mx-auto">
          Pusat Operasi dan Inteligensi Bisnis Modulajar. 
          Pilih modul di bawah untuk mulai monitoring.
        </p>
        <div className="flex gap-4 justify-center pt-8">
          <a href="/revenue" className="px-6 py-3 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-700 transition-all">Revenue Analysis</a>
          <a href="/support" className="px-6 py-3 bg-slate-800 rounded-2xl font-bold hover:bg-slate-700 transition-all">Support & Ops</a>
        </div>
      </div>
    </div>
  );
}

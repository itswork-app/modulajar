import { SignIn } from "@clerk/nextjs";
import { ShieldCheck } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background Effects matching Marketing/HQ */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] -mr-48 -mt-48 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] -ml-48 -mb-48 pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] brightness-100 contrast-150" />

      {/* Decorative Brand Header */}
      <div className="mb-12 text-center relative z-10 flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-2xl shadow-2xl shadow-primary/20 animate-in zoom-in duration-700">
          M
        </div>
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">HQ COMMAND</h1>
          <p className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] mt-2">Administrative Interface</p>
        </div>
      </div>

      <div className="relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <SignIn 
          appearance={{
            elements: {
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-sm font-black uppercase tracking-widest h-11 transition-all shadow-lg shadow-primary/20",
              card: "bg-slate-900 border border-slate-800 shadow-2xl rounded-3xl backdrop-blur-sm",
              headerTitle: "text-white font-black text-xl tracking-tight",
              headerSubtitle: "text-slate-500 font-bold",
              socialButtonsBlockButton: "bg-slate-800 border-slate-700 hover:bg-slate-700 text-white font-bold transition-all",
              socialButtonsBlockButtonText: "text-white",
              formFieldLabel: "text-slate-400 font-black uppercase text-[10px] tracking-widest",
              formFieldInput: "bg-slate-950 border-slate-800 text-white focus:ring-primary focus:border-primary rounded-xl transition-all",
              footerActionText: "text-slate-500 font-bold",
              footerActionLink: "text-primary hover:text-primary/80 font-black",
              identityPreviewText: "text-white font-bold",
              identityPreviewEditButton: "text-primary hover:text-primary/80"
            }
          }}
          routing="path"
          path="/sign-in"
          fallbackRedirectUrl="/"
        />
      </div>

      {/* Trust Badge */}
      <div className="mt-12 flex items-center gap-2 opacity-30 relative z-10">
        <ShieldCheck className="w-4 h-4 text-slate-500" />
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Encrypted Internal Access only</span>
      </div>
    </div>
  );
}

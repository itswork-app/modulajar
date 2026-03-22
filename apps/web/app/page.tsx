'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Zap,
  ShieldCheck,
  FileCheck,
  ArrowRight,
  CheckCircle2,
  Layout,
  CloudDownload
} from 'lucide-react';
import { cn } from '@/lib/utils';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.modulajar.app';
const VERIFY_URL = process.env.NEXT_PUBLIC_VERIFY_URL || 'https://verify.modulajar.app';

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen bg-white text-slate-900 font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">M</div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Modulajar</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="#features" className="hover:text-emerald-600 transition-colors">Fitur</Link>
            <Link href="#how-it-works" className="hover:text-emerald-600 transition-colors">Cara Kerja</Link>
            <Link href={APP_URL} className="px-4 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-all shadow-sm shadow-emerald-200">
              Masuk App
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 pt-32 pb-20">
        {/* Hero Section */}
        <section className="max-w-5xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20 mb-8">
              v1.0 is live • Verifikasi publik aktif
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-slate-900 mb-6 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 to-slate-600">
              Modul Ajar siap pakai.
            </h1>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Generate cepat. PDF terproteksi + watermark. <br className="hidden md:block" />
              Verifikasi publik via PID/DID untuk transparansi pendidikan.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={APP_URL}
                className="w-full sm:w-auto px-8 py-4 bg-emerald-600 text-white rounded-2xl font-semibold shadow-xl shadow-emerald-200 hover:bg-emerald-700 hover:-translate-y-1 transition-all flex items-center justify-center gap-2 group text-lg"
              >
                Masuk App
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href={VERIFY_URL}
                className="w-full sm:w-auto px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-2xl font-semibold hover:bg-slate-50 transition-all text-lg flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                Cek Verifikasi
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-7xl mx-auto px-4 mt-40">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Mengapa Modulajar?</h2>
            <p className="text-slate-500 mt-4">Standar baru dalam pembuatan administrasi pendidikan.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Zap className="w-8 h-8 text-amber-500" />}
              title="Cepat"
              description="Pilih kelas, mata pelajaran, dan semester. Sistem kami akan menata struktur modul ajar secara otomatis dalam hitungan detik."
            />
            <FeatureCard
              icon={<FileCheck className="w-8 h-8 text-emerald-500" />}
              title="Compliance-ready"
              description="Struktur dokumen rapi dan sesuai standar kurikulum nasional. Siap untuk keperluan audit administrasi sekolah."
            />
            <FeatureCard
              icon={<ShieldCheck className="w-8 h-8 text-blue-500" />}
              title="Trust"
              description="Output PDF dilengkapi dengan watermark keamanan dan link verifikasi publik untuk membuktikan keaslian dokumen."
            />
          </div>
        </section>

        {/* How it Works Section */}
        <section id="how-it-works" className="bg-slate-50 py-24 mt-40 rounded-[3rem]">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-slate-900">Cara Kerja</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
              <Step
                num="1"
                icon={<Layout className="w-10 h-10 text-emerald-600" />}
                title="Pilih Parameter"
                description="Pilih jenjang, kelas, mata pelajaran, dan semester yang ingin Anda buat."
              />
              <Step
                num="2"
                icon={<Zap className="w-10 h-10 text-emerald-600" />}
                title="Generate"
                description="Engine kami menyusun TP, ATP, dan Modul Ajar sesuai parameter yang Anda tentukan."
              />
              <Step
                num="3"
                icon={<CloudDownload className="w-10 h-10 text-emerald-600" />}
                title="Selesai"
                description="Download PDF yang sudah terverifikasi dan siap digunakan di kelas."
              />
            </div>
          </div>
        </section>

        {/* CTA Footer */}
        <section className="max-w-5xl mx-auto px-4 mt-40 text-center">
          <div className="bg-slate-900 rounded-[3rem] py-20 px-8">
            <h3 className="text-3xl md:text-4xl font-bold text-white mb-6">Mulai adminstrasi lebih baik hari ini.</h3>
            <p className="text-slate-400 mb-10 max-w-xl mx-auto text-lg leading-relaxed">
              Bergabunglah dengan ribuan pendidik yang telah beralih ke cara pembuatan modul ajar yang lebih cerdas.
            </p>
            <Link
              href={APP_URL}
              className="px-10 py-5 bg-emerald-600 text-white rounded-2xl font-bold text-xl hover:bg-emerald-500 transition-all inline-flex items-center gap-3 shadow-2xl shadow-emerald-500/20"
            >
              Coba Sekarang Gratis
              <ArrowRight className="w-6 h-6" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center text-white font-bold text-xs font-mono">M</div>
            <span className="text-sm font-bold tracking-tight text-slate-900 uppercase">Modulajar</span>
          </div>
          <div className="text-slate-400 text-sm">
            © {new Date().getFullYear()} itswork-app. Semua hak dilindungi undang-undang.
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-8 rounded-[2rem] border border-slate-100 hover:border-emerald-100 hover:shadow-2xl hover:shadow-emerald-100/50 transition-all group bg-white">
      <div className="mb-6 p-4 rounded-2xl bg-slate-50 group-hover:bg-emerald-50 transition-colors w-fit">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 leading-relaxed">{description}</p>
    </div>
  );
}

function Step({ num, icon, title, description }: { num: string, icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col items-center text-center group">
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-3xl bg-white shadow-xl flex items-center justify-center relative z-10 group-hover:-translate-y-2 transition-transform duration-300">
          {icon}
        </div>
        <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-black border-4 border-slate-50 z-20 shadow-md">
          {num}
        </div>
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed max-w-xs">{description}</p>
    </div>
  );
}

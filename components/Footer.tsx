import React from 'react';
import { Lightbulb, Navigation } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <div className="mt-16 mb-8 px-4">
      <div className="relative overflow-hidden bg-primary-900 rounded-3xl p-8 text-white shadow-card">
        {/* Decorative Circle */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-accent-red to-primary-500"></div>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-6 text-yellow-300">
            <Lightbulb size={20} className="fill-current" />
            <h2 className="text-lg font-bold tracking-wide uppercase">Travel Pro Tips</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 text-sm text-primary-100 leading-relaxed">
            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/5">
              <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                <Navigation size={16} /> Google Maps 秘訣
              </h3>
              <p>
                請務必使用 <span className="text-white font-semibold underline decoration-accent-red decoration-2">日文地址</span> 進行導航。英文地址容易造成定位誤差，尤其是在尋找特定建築入口時。
              </p>
            </div>

            <div className="bg-white/10 p-4 rounded-xl backdrop-blur-sm border border-white/5">
              <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                <Navigation size={16} /> 關於飯店位置
              </h3>
              <p>
                <strong>Hotel WBF Grande Hakata</strong> 位於博多站筑紫口步行範圍內，若搭乘計程車，請出示日文地址給司機看，以免混淆。
              </p>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-primary-300">
            <span>2026/2/27 (五) - 3/2 (一) 福岡之旅</span>
          </div>
        </div>
      </div>
    </div>
  );
};
with open('scratch/indonesia_clean.tsx', 'r', encoding='utf-8') as f:
    indonesia = f.read()

start_idx = indonesia.find('<section>')
start_idx = indonesia.find('<section>', start_idx + 1)
end_idx = indonesia.find('</section>', start_idx) + 10

section_5 = indonesia[start_idx:end_idx]

# Fix the title inside section_5
section_5 = section_5.replace('<Network className="h-6 w-6 text-violet-500" />\n          <h2 className="text-xl font-black text-gray-900">Estrutura Orgânica das Células</h2>', '<span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">5</span>\n          <h2 className="text-xl font-black text-gray-900">Células ideais — Visão Indonésia (Havruta)</h2>')

with open('src/pages/LabVision.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Insert before {/* CONCLUSÃO */}
target_marker = '{/* CONCLUSÃO                                         */}'
idx = code.find(target_marker)

code = code[:idx-40] + section_5 + '\n\n      {/* ══════════════════════════════════════════════════ */}\n      ' + code[idx:]

with open('src/pages/LabVision.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Inserted Section 5 successfully!")

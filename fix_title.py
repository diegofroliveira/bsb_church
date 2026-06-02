import re

with open('src/pages/LabVision.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    '<Network className="h-6 w-6 text-violet-500" />\n          <h2 className="text-xl font-black text-gray-900">Estrutura Orgânica das Células</h2>',
    '<span className="w-7 h-7 rounded-full bg-gray-900 text-white text-xs font-black flex items-center justify-center shrink-0">5</span>\n          <h2 className="text-xl font-black text-gray-900">Células ideais — Visão Indonésia (Havruta)</h2>'
)

with open('src/pages/LabVision.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Title fixed!")

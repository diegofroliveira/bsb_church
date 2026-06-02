with open('scratch/LabVision_Indonesia.tsx', 'r', encoding='utf-16') as f:
    indonesia = f.read()

start_idx = indonesia.find('<section>', indonesia.find('Estrutura Orgânica das Células') - 100)
end_idx = indonesia.find('</section>', start_idx) + 10

section_5_new = indonesia[start_idx:end_idx]

# In LabVision, read it as array of lines
with open('src/pages/LabVision.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

lines = lines[:590] + [section_5_new + '\n'] + lines[694:]

with open('src/pages/LabVision.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Replaced section 5 correctly!")

from pathlib import Path
text = Path('app/admin/page.tsx').read_text()
idx = text.find('const calculateEditMonthlyCost')
print(idx)

import requests, json
r = requests.get('http://localhost:8000/api/fairness')
data = r.json()
print(f"Overall: {data['overall_verdict']} | Worst DIR: {data['worst_dir']} | Flagged: {data['flagged_dimensions']}")
print(f"Total samples: {data['total_samples']}\n")
for dim, info in data['dimensions'].items():
    sig = "⚠ FLAGGED" if info['has_significant'] else "✅ Fair"
    print(f"  {dim}: min_dir={info['min_dir']} {sig}")
    for group, m in info['group_metrics'].items():
        print(f"    {group:20s} DIR={m['dir']:.3f}  rate={m['rate']*100:.1f}%  p={m['p_value']:.4f}  n={m['n']}  [{m['verdict']}]")
    print()

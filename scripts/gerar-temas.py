"""Gera src/app/temas.css a partir dos registries de tema (tweakcn e shadcnblocks).

Uso: python3 scripts/gerar-temas.py
Para adicionar um tema: inclua uma linha em TEMAS aqui e em src/lib/temas.ts.
"""
import json
import re
import urllib.request
from pathlib import Path

SAIDA = Path(__file__).resolve().parent.parent / 'src' / 'app' / 'temas.css'
SHADCNBLOCKS = 'https://www.shadcnblocks.com/r/{name}.json'

# slug, nome, origem (o mesmo endereço do `shadcn add`). O primeiro é o padrão.
TEMAS = [
    ('claude', 'Claude +', 'https://tweakcn.com/r/themes/cmdght103000n04lh3e2ae93r'),
    ('supabase', 'Supabase', 'https://tweakcn.com/r/themes/cmmdxhg6d000804l5f6xlcbh3'),
    ('brutalist', 'MX Brutalist', 'https://tweakcn.com/r/themes/cmllfu8oc000004l1a0tidj2g'),
    ('alpha', 'Alpha', 'https://tweakcn.com/r/themes/cmw731cz1000004id2b0dapwp'),
    ('vs-code', 'VS Code', '@shadcnblocks/theme/vs-code'),
    ('stella', 'Stella', '@shadcnblocks/theme/stella'),
    ('typewriter', 'Typewriter', 'https://tweakcn.com/r/themes/cmt5ycr4z000004k3cd3gem4w'),
]

# Família -> variável do next/font carregada em src/app/layout.tsx.
FONTES = [
    ('Geist Mono', 'geist-mono'), ('Geist', 'geist'), ('Outfit', 'outfit'),
    ('Montserrat', 'montserrat'), ('Space Mono', 'space-mono'), ('Lora', 'lora'),
    ('Courier Prime', 'courier-prime'), ('Cormorant Garamond', 'cormorant-garamond'),
    ('EB Garamond', 'eb-garamond'), ('Inter', 'inter'),
]

# destructive-foreground fica com o app: o ReUI usa como texto sobre fundo claro.
IGNORAR = {'spacing', 'letter-spacing', 'destructive-foreground'}


# O "alpha" do tweakcn não tem modo escuro (o dark é cópia do light). Escuro derivado
# da mesma paleta azul-marinho, aplicado por cima do que vier do registry.
ESCURO_PROPRIO = {
    'alpha': {
        'background': 'oklch(0.1900 0.0300 266.9539)',
        'foreground': 'oklch(0.9600 0.0060 247.8575)',
        'card': 'oklch(0.2300 0.0350 266.9539)',
        'card-foreground': 'oklch(0.9600 0.0060 247.8575)',
        'popover': 'oklch(0.2300 0.0350 266.9539)',
        'popover-foreground': 'oklch(0.9600 0.0060 247.8575)',
        'primary': 'oklch(0.8200 0.0600 262.0000)',
        'primary-foreground': 'oklch(0.2200 0.0500 266.9539)',
        'secondary': 'oklch(0.2900 0.0350 266.9539)',
        'secondary-foreground': 'oklch(0.9600 0.0060 247.8575)',
        'muted': 'oklch(0.2700 0.0300 266.9539)',
        'muted-foreground': 'oklch(0.7200 0.0250 260.0000)',
        'accent': 'oklch(0.3000 0.0400 266.9539)',
        'accent-foreground': 'oklch(0.9600 0.0060 247.8575)',
        'border': 'oklch(1 0 0 / 12%)',
        'input': 'oklch(1 0 0 / 16%)',
        'ring': 'oklch(0.8200 0.0600 262.0000)',
        'sidebar': 'oklch(0.1600 0.0280 266.9539)',
        'sidebar-foreground': 'oklch(0.9600 0.0060 247.8575)',
        'sidebar-primary': 'oklch(0.8200 0.0600 262.0000)',
        'sidebar-primary-foreground': 'oklch(0.2200 0.0500 266.9539)',
        'sidebar-accent': 'oklch(0.2700 0.0350 266.9539)',
        'sidebar-accent-foreground': 'oklch(0.9600 0.0060 247.8575)',
        'sidebar-border': 'oklch(1 0 0 / 10%)',
        'sidebar-ring': 'oklch(0.8200 0.0600 262.0000)',
    },
}


def baixar(origem):
    if origem.startswith('@shadcnblocks/'):
        origem = SHADCNBLOCKS.format(name=origem.removeprefix('@shadcnblocks/'))
    with urllib.request.urlopen(origem) as r:
        return json.load(r)


def fontes(valor):
    for nome, var in FONTES:
        valor = re.sub(r"""(['"]?)%s\1(?=\s*(,|$))""" % re.escape(nome), f'var(--font-{var})', valor)
    return ' '.join(valor.split())


def bloco(seletor, variaveis):
    linhas = [seletor + ' {']
    for k, v in variaveis.items():
        if k in IGNORAR:
            continue
        if k.startswith('font'):
            v = fontes(v)
        linhas.append(f'  --{k}: {v};')
    linhas.append('}')
    return '\n'.join(linhas)


css = [
    '/* Gerado por scripts/gerar-temas.py a partir dos registries tweakcn/shadcnblocks. Não editar à mão.',
    '   Tema padrão em :root/.dark; demais via <html data-theme="slug">. */',
    '',
]
for i, (slug, nome, origem) in enumerate(TEMAS):
    cv = baixar(origem)['cssVars']
    cv['dark'] = {**cv['dark'], **ESCURO_PROPRIO.get(slug, {})}
    claro = f'[data-theme="{slug}"]'
    escuro = f'[data-theme="{slug}"].dark,\n.dark [data-theme="{slug}"]'
    if i == 0:
        claro = ':root,\n' + claro
        escuro = '.dark,\n' + escuro
    css += [f'/* {nome} — {origem} */', bloco(claro, cv['light']), bloco(escuro, cv['dark']), '']

SAIDA.write_text('\n'.join(css))
print('ok:', SAIDA)

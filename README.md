# Basílica de Nazaré · Construção 3D

**Site:** [raphaelsr.github.io/basilica-nazare-3d](https://raphaelsr.github.io/basilica-nazare-3d/)

Miniatura procedural da Basílica Santuário de Nossa Senhora de Nazaré, em Belém (PA), que se constrói em tempo real. A experiência apresenta embasamento de granito, colunata interna, alvenaria em fiadas, telhados de barro, transepto, coro e ábside, pórtico de granito rosa, frontão dourado e dois campanários com relógios, sinos, templetes e cúpulas.

Toda a arquitetura é gerada com Three.js, sem modelos externos ou chaves de API. O modelo é uma interpretação visual; o painel de informações apresenta as medidas históricas publicadas pela organização do Círio.

É uma interpretação estilizada a partir de fotos e do Google Maps 3D, não uma reconstrução métrica.

## Rodar

Requer Node.js 22.13+ e um navegador com WebGL2.

```sh
npm ci
npm run dev        # http://127.0.0.1:5173
npm run build      # tsc --noEmit + vite build
npm run preview
```

## Recursos

- construção arquitetônica contínua com linha do tempo interativa;
- órbita e zoom livres;
- vistas de detalhe da fachada, campanários e fundos;
- interface em português, espanhol e inglês;
- painel de informações com medidas e detalhes da fonte oficial;
- contador do próximo Círio com link para a programação oficial;
- exportação da simulação em vídeo MP4 vertical (1080 × 1920, 30 fps);
- materiais, texturas e geometria totalmente procedurais.

Use o mouse ou toque para orbitar, a rolagem para aproximar e a linha do tempo para avançar ou retroceder a obra. Os botões abaixo da miniatura selecionam câmeras de detalhe.

## Onde mexer

| Arquivo | Para |
| --- | --- |
| `src/heritage/architecture.ts` | geometria e linha do tempo da construção |
| `src/heritage/materials.ts` | paleta e texturas procedurais (mármore, granito, telha, madeira, dourado, ferro) |
| `src/heritage/builder.ts` | batching por material e animação de montagem no shader (color e depth compartilham o mesmo deslocamento) |
| `src/BasilicaScene.tsx` | luzes, câmeras, OrbitControls, cache de sombras e render sob demanda |
| `src/App.tsx` | interface, linha do tempo e botões de vista |
| `src/i18n.ts` | textos em português, espanhol e inglês |

Gerado com a skill `threejs-architecture-effects` (MIT).

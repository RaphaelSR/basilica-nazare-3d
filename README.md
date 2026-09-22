# Basílica de Nazaré · Construção 3D

Miniatura procedural da Basílica Santuário de Nossa Senhora de Nazaré (Belém, PA) que se constrói sozinha: embasamento de granito, colunata interna, alvenaria em fiadas, treliças e telhas de barro, pórtico coríntio, frontão dourado, dois campanários com cúpulas e uma abside semicircular. Tudo é geometria procedural em Three.js, sem modelos externos e sem chaves de API.

É uma interpretação estilizada a partir de fotos e do Google Maps 3D, não uma reconstrução métrica.

## Rodar

Requer Node.js 22.13+ e um navegador com WebGL2.

```sh
npm ci
npm run dev        # http://127.0.0.1:5173
npm run build      # tsc --noEmit + vite build
npm run preview
```

Controles: arraste para orbitar, rolagem para aproximar, linha do tempo para avançar/retroceder a obra, botões **Campanários** e **Pórtico e frontão** para câmeras de detalhe.

## Onde mexer

| Arquivo | Para |
| --- | --- |
| `src/heritage/architecture.ts` | toda a geometria e a linha do tempo (constantes de projeto no topo, `T.mason/bell/drum` para o ritmo) |
| `src/heritage/materials.ts` | paleta e texturas procedurais (mármore, granito, telha, madeira, dourado, ferro) |
| `src/heritage/builder.ts` | batching por material e animação de montagem no shader (color e depth compartilham o mesmo deslocamento) |
| `src/BasilicaScene.tsx` | luzes, câmeras, OrbitControls, cache de sombras e render sob demanda |
| `src/App.tsx` | timeline, rótulos de etapa e botões de vista |

Gerado com a skill `threejs-architecture-effects` (MIT).

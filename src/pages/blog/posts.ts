// Static blog content — "real talk" on the numbers behind renting, owning, and
// running a property. No fluff, no affiliate spin. Update figures as the market moves.
// Content is bilingual (EN/ES); resolve a field with post.title[lang] etc.

export interface Loc { en: string; es: string }
export interface BlogSection { heading?: Loc; body: Loc[] }
export interface BlogPost {
  slug: string;
  title: Loc;
  category: Loc;
  excerpt: Loc;
  readMins: number;
  updated: string; // ISO date
  sections: BlogSection[];
}

export const POSTS: BlogPost[] = [
  {
    slug: 'true-cost-of-owning-a-rental',
    title: {
      en: 'What it actually costs to own a rental in 2026',
      es: 'Lo que realmente cuesta tener una propiedad de alquiler en 2026',
    },
    category: { en: 'Housing costs', es: 'Costos de vivienda' },
    excerpt: {
      en: 'The mortgage is the part everyone quotes. Here is the rest of the bill — the part that decides whether you actually make money.',
      es: 'La hipoteca es la parte que todos mencionan. Aquí está el resto de la cuenta — la parte que decide si de verdad ganas dinero.',
    },
    readMins: 9,
    updated: '2026-07-05',
    sections: [
      { body: [
        {
          en: 'Real talk: the listing price and the mortgage payment are the two numbers new landlords fixate on, and they are the two least useful for predicting whether a rental makes money. The costs that sink first-time landlords are the recurring ones nobody puts on the spreadsheet.',
          es: 'Hablemos claro: el precio de venta y el pago de la hipoteca son los dos números en los que se obsesionan los arrendadores nuevos, y son los dos menos útiles para predecir si un alquiler genera dinero. Los costos que hunden a los arrendadores primerizos son los recurrentes que nadie pone en la hoja de cálculo.',
        },
      ] },
      { heading: { en: 'The recurring costs that add up', es: 'Los costos recurrentes que se acumulan' }, body: [
        {
          en: 'Property taxes (often 0.5%–2.5% of value per year, wildly location-dependent), landlord insurance (typically 15–25% more than a homeowner policy), maintenance (a common rule of thumb is 1% of the property value per year, or ~$1 per square foot), and vacancy (budget at least one month of lost rent per year, more in a soft market).',
          es: 'Impuestos sobre la propiedad (a menudo 0.5%–2.5% del valor al año, muy dependiente de la ubicación), seguro del arrendador (normalmente 15–25% más que una póliza de propietario), mantenimiento (una regla común es el 1% del valor de la propiedad al año, o ~$1 por pie cuadrado) y vacancia (presupuesta al menos un mes de renta perdida al año, más en un mercado débil).',
        },
        {
          en: 'Add property management if you are not self-managing (8–12% of collected rent), HOA dues where they apply, and capital expenses — the roof, HVAC, and water heater that do not fail on a schedule but always fail eventually.',
          es: 'Agrega la administración de la propiedad si no la gestionas tú mismo (8–12% de la renta cobrada), las cuotas de la asociación de propietarios cuando apliquen, y los gastos de capital — el techo, la climatización y el calentador de agua que no fallan en una fecha programada pero siempre fallan eventualmente.',
        },
      ] },
      { heading: { en: 'A quick gut check', es: 'Una comprobación rápida' }, body: [
        {
          en: 'The 50% rule is crude but honest: over time, roughly half of your rent disappears into expenses before the mortgage. If rent is $2,000, assume ~$1,000 goes to taxes, insurance, maintenance, vacancy, and management, leaving $1,000 to cover the loan. If your mortgage is $1,100, you are negative — even though the property "rents for more than the payment."',
          es: 'La regla del 50% es tosca pero honesta: con el tiempo, aproximadamente la mitad de tu renta desaparece en gastos antes de la hipoteca. Si la renta es $2,000, supón que ~$1,000 se va en impuestos, seguro, mantenimiento, vacancia y administración, dejando $1,000 para cubrir el préstamo. Si tu hipoteca es $1,100, estás en negativo — aunque la propiedad "se alquile por más que el pago".',
        },
      ] },
      { heading: { en: 'A worked example: the $300,000 rental', es: 'Un ejemplo con números: el alquiler de $300,000' }, body: [
        {
          en: 'Say you buy a $300,000 single-family home that rents for $2,200. At 25% down and a 6.75% investment-property rate, the loan payment on $225,000 is about $1,460. Now the rest: property tax at 1.2% is $300/month, landlord insurance ~$140, maintenance reserve at 1% of value is $250, vacancy at one month a year is $183, and capital-expense reserve another $150. That is roughly $1,023 in monthly expenses before the mortgage.',
          es: 'Supón que compras una casa unifamiliar de $300,000 que se alquila en $2,200. Con 25% de enganche y una tasa de 6.75% para propiedad de inversión, el pago del préstamo de $225,000 es de unos $1,460. Ahora el resto: impuesto sobre la propiedad al 1.2% son $300/mes, seguro de arrendador ~$140, reserva de mantenimiento al 1% del valor son $250, vacancia de un mes al año son $183, y la reserva para gastos de capital otros $150. Eso es aproximadamente $1,023 en gastos mensuales antes de la hipoteca.',
        },
        {
          en: 'Total outflow: about $2,483 against $2,200 in rent. That "cashflowing" property loses ~$283 a month in a normal year — and that is with nothing going wrong. The deal only works if you bought below market, put more down, or rents rise faster than costs. Running this math before you buy is the whole game.',
          es: 'Salida total: unos $2,483 contra $2,200 de renta. Esa propiedad que "genera flujo" pierde ~$283 al mes en un año normal — y eso sin que nada salga mal. El trato solo funciona si compraste por debajo del mercado, diste más enganche, o las rentas suben más rápido que los costos. Hacer estas cuentas antes de comprar es todo el juego.',
        },
      ] },
      { heading: { en: 'Capital expenses: the budget killers', es: 'Gastos de capital: los que rompen el presupuesto' }, body: [
        {
          en: 'A roof lasts 20–30 years and costs $10,000–$20,000. An HVAC system lasts 15–20 years at $6,000–$12,000. A water heater lasts 8–12 years at $1,200–$2,500. None of these are surprises — they are scheduled failures with unknown dates. Divide replacement cost by remaining life and you get the honest monthly reserve: an aging roof alone can justify $60–$80 a month set aside.',
          es: 'Un techo dura 20–30 años y cuesta $10,000–$20,000. Un sistema de climatización dura 15–20 años y cuesta $6,000–$12,000. Un calentador de agua dura 8–12 años y cuesta $1,200–$2,500. Ninguno es una sorpresa — son fallas programadas con fecha desconocida. Divide el costo de reemplazo entre la vida útil restante y obtienes la reserva mensual honesta: solo un techo viejo puede justificar apartar $60–$80 al mes.',
        },
        {
          en: 'The inspection report from when you bought is your capital-expense forecast. Every "nearing end of useful life" line is a bill with a fuse lit. Landlords who skip the reserve do not avoid the cost — they just pay it all at once, usually in the same month a tenant moves out.',
          es: 'El informe de inspección de cuando compraste es tu pronóstico de gastos de capital. Cada línea de "cerca del final de su vida útil" es una factura con la mecha encendida. Los arrendadores que omiten la reserva no evitan el costo — solo lo pagan todo de una vez, normalmente el mismo mes en que un inquilino se muda.',
        },
      ] },
      { heading: { en: 'The tax side: what you get back', es: 'El lado fiscal: lo que recuperas' }, body: [
        {
          en: 'The good news: nearly every cost above is deductible against rental income — mortgage interest, taxes, insurance, repairs, management fees, even the mileage to check on the property. On top of that, depreciation lets you deduct the building (not land) over 27.5 years: on a $300,000 property with $60,000 of land value, that is ~$8,700 a year of paper losses that can shelter your rental income.',
          es: 'La buena noticia: casi todos los costos anteriores son deducibles contra el ingreso por alquiler — intereses de la hipoteca, impuestos, seguro, reparaciones, honorarios de administración, incluso el kilometraje para revisar la propiedad. Además, la depreciación te permite deducir el edificio (no el terreno) a lo largo de 27.5 años: en una propiedad de $300,000 con $60,000 de valor de terreno, eso es ~$8,700 al año de pérdidas contables que pueden proteger tu ingreso por alquiler.',
        },
        {
          en: 'The catch is documentation. A shoebox of receipts in April means missed deductions and an expensive accountant bill. Log expenses when they happen, tagged to the property, and tax season becomes an export instead of an archaeology project.',
          es: 'El truco está en la documentación. Una caja de recibos en abril significa deducciones perdidas y una factura cara del contador. Registra los gastos cuando ocurren, etiquetados a la propiedad, y la temporada de impuestos se convierte en una exportación en lugar de un proyecto de arqueología.',
        },
      ] },
      { heading: { en: 'Where HappyHomesHub helps', es: 'Dónde ayuda HappyHomesHub' }, body: [
        {
          en: 'You cannot manage what you do not track. Logging every expense against the property (and exporting it at tax time) is the difference between guessing your return and knowing it. That is exactly why expense tracking, cashflow charts, and Schedule E export are free on the Home plan.',
          es: 'No puedes gestionar lo que no mides. Registrar cada gasto de la propiedad (y exportarlo en la temporada de impuestos) es la diferencia entre adivinar tu rendimiento y conocerlo. Por eso exactamente el control de gastos, los gráficos de flujo de efectivo y la exportación Schedule E son gratis en el plan Home.',
        },
      ] },
    ],
  },
  {
    slug: 'renting-vs-buying-the-honest-math',
    title: { en: 'Renting vs buying: the honest math', es: 'Alquilar vs comprar: las cuentas honestas' },
    category: { en: 'Renting costs', es: 'Costos de alquiler' },
    excerpt: {
      en: 'Buying is not always "throwing money away on rent" in reverse. Here is how to actually compare the two.',
      es: 'Comprar no siempre es lo contrario de "tirar el dinero en alquiler". Así es como comparar de verdad las dos opciones.',
    },
    readMins: 9,
    updated: '2026-07-05',
    sections: [
      { body: [
        {
          en: 'The "rent is throwing money away" line ignores that a big chunk of an early mortgage payment is interest — also money you never get back. The real comparison is total cost of renting vs total cost of owning over the years you will actually stay.',
          es: 'La frase "el alquiler es tirar el dinero" ignora que una gran parte de un pago hipotecario inicial son intereses — dinero que tampoco recuperas. La comparación real es el costo total de alquilar vs el costo total de ser propietario durante los años que realmente te quedarás.',
        },
      ] },
      { heading: { en: 'The costs people forget on the buy side', es: 'Los costos que la gente olvida al comprar' }, body: [
        {
          en: 'Closing costs (2–5% of price), mortgage interest, property tax, insurance, maintenance, and the opportunity cost of your down payment sitting in the house instead of invested. Transaction costs alone mean buying rarely wins if you move within ~3–5 years.',
          es: 'Costos de cierre (2–5% del precio), intereses de la hipoteca, impuesto sobre la propiedad, seguro, mantenimiento, y el costo de oportunidad de tu enganche atrapado en la casa en lugar de invertido. Solo los costos de transacción hacen que comprar rara vez gane si te mudas en ~3–5 años.',
        },
      ] },
      { heading: { en: 'The price-to-rent ratio shortcut', es: 'El atajo de la relación precio-alquiler' }, body: [
        {
          en: "Divide a home's price by its annual rent. Under ~15, buying tends to win; over ~21, renting and investing the difference often wins; in between, it depends on how long you stay and local appreciation. It is a starting point, not gospel.",
          es: 'Divide el precio de una vivienda entre su renta anual. Por debajo de ~15, comprar suele ganar; por encima de ~21, alquilar e invertir la diferencia a menudo gana; en el medio, depende de cuánto te quedes y de la revalorización local. Es un punto de partida, no una verdad absoluta.',
        },
      ] },
      { heading: { en: 'A worked example over five years', es: 'Un ejemplo con números a cinco años' }, body: [
        {
          en: 'Take a $350,000 house vs the same house renting for $2,000. Buying with 10% down at 6.5%: about $1,990/month principal and interest, plus ~$350 tax, ~$120 insurance, ~$290 maintenance — call it $2,750 a month, of which only ~$330 builds equity in year one. Selling in year five costs another 6–8% in agent fees and closing costs, roughly $25,000.',
          es: 'Toma una casa de $350,000 frente a la misma casa alquilada en $2,000. Comprando con 10% de enganche al 6.5%: unos $1,990/mes de capital e intereses, más ~$350 de impuestos, ~$120 de seguro, ~$290 de mantenimiento — digamos $2,750 al mes, de los cuales solo ~$330 construyen patrimonio el primer año. Vender en el año cinco cuesta otro 6–8% en comisiones y costos de cierre, aproximadamente $25,000.',
        },
        {
          en: 'The renter pays $2,000, invests the $750 difference plus the $35,000 down payment, and walks away anytime. For the buyer to come out ahead in five years, the house needs meaningful appreciation — roughly 3%+ per year in this example — just to cover transaction costs and interest. Over fifteen years, the math flips hard toward owning. Time horizon is the whole answer.',
          es: 'El inquilino paga $2,000, invierte los $750 de diferencia más los $35,000 del enganche, y puede irse cuando quiera. Para que el comprador salga ganando en cinco años, la casa necesita una revalorización significativa — aproximadamente 3%+ anual en este ejemplo — solo para cubrir los costos de transacción y los intereses. A quince años, las cuentas se inclinan fuertemente hacia comprar. El horizonte de tiempo es toda la respuesta.',
        },
      ] },
      { heading: { en: 'What renters forget to count', es: 'Lo que los inquilinos olvidan contar' }, body: [
        {
          en: 'Renting has its own quiet costs: renewal increases (3–5% a year compounds fast), moving every few years ($1,500–$4,000 per move counting deposits, trucks, and time off), and the discipline problem — the rent-vs-buy math only works if you actually invest the difference instead of absorbing it into lifestyle. Most people do not.',
          es: 'Alquilar tiene sus propios costos silenciosos: aumentos de renovación (3–5% al año se acumula rápido), mudarse cada pocos años ($1,500–$4,000 por mudanza contando depósitos, camiones y días libres), y el problema de disciplina — las cuentas de alquilar vs comprar solo funcionan si de verdad inviertes la diferencia en lugar de absorberla en el estilo de vida. La mayoría no lo hace.',
        },
        {
          en: 'There is also rent risk: your housing cost is repriced by the market every year, while a fixed mortgage locks the biggest line item for decades. In supply-constrained cities, that lock has real value.',
          es: 'También existe el riesgo de renta: tu costo de vivienda se reajusta al mercado cada año, mientras que una hipoteca fija asegura la partida más grande por décadas. En ciudades con poca oferta, ese seguro tiene un valor real.',
        },
      ] },
      { heading: { en: 'When each side clearly wins', es: 'Cuándo gana claramente cada lado' }, body: [
        {
          en: 'Renting clearly wins when: you may move within ~4 years, your job or family situation is in flux, the local price-to-rent ratio is above ~21, or you would drain your emergency fund to make the down payment. Buying clearly wins when: you will stay 7+ years, the ratio is under ~15, your payment fits under ~30% of income with reserves left over, and you want the inflation hedge of a fixed payment.',
          es: 'Alquilar gana claramente cuando: podrías mudarte en ~4 años, tu trabajo o situación familiar está en cambio, la relación precio-alquiler local está por encima de ~21, o vaciarías tu fondo de emergencia para dar el enganche. Comprar gana claramente cuando: te quedarás 7+ años, la relación está por debajo de ~15, el pago cabe en menos del ~30% de tus ingresos con reservas de sobra, y quieres la cobertura contra inflación de un pago fijo.',
        },
      ] },
      { heading: { en: 'Real talk', es: 'Hablemos claro' }, body: [
        {
          en: 'Renting buys flexibility and a capped downside; owning buys stability and forced savings with a leveraged bet on one asset in one location. Neither is "smarter." Run your own numbers for the years you will actually stay — not the 30-year fantasy.',
          es: 'Alquilar compra flexibilidad y una pérdida limitada; ser propietario compra estabilidad y ahorro forzado con una apuesta apalancada en un solo activo en una sola ubicación. Ninguno es "más inteligente". Haz tus propios números para los años que realmente te quedarás — no para la fantasía de 30 años.',
        },
      ] },
    ],
  },
  {
    slug: 'mortgage-rates-2026-landlords',
    title: { en: 'Mortgage rates in 2026: what landlords should know', es: 'Tasas hipotecarias en 2026: lo que los arrendadores deben saber' },
    category: { en: 'Mortgage rates', es: 'Tasas hipotecarias' },
    excerpt: {
      en: 'Investment-property loans are not the rate you see advertised. Here is what moves them and what to expect.',
      es: 'Los préstamos para propiedades de inversión no tienen la tasa que ves anunciada. Esto es lo que las mueve y qué esperar.',
    },
    readMins: 8,
    updated: '2026-07-05',
    sections: [
      { body: [
        {
          en: 'The headline 30-year rate you see in the news is for an owner-occupied primary residence with strong credit. Investment-property mortgages price higher — commonly 0.5–0.875 percentage points above — because lenders consider rentals riskier.',
          es: 'La tasa a 30 años que ves en las noticias es para una residencia principal ocupada por el dueño con buen crédito. Las hipotecas para propiedades de inversión cuestan más — comúnmente 0.5–0.875 puntos porcentuales por encima — porque los prestamistas consideran que los alquileres son más riesgosos.',
        },
      ] },
      { heading: { en: 'What lenders look at', es: 'Qué miran los prestamistas' }, body: [
        {
          en: "Down payment (expect 20–25% minimum on a rental), credit score, cash reserves (often 6 months of payments), and the property's own projected rent, which can count toward qualifying income via the debt-service-coverage approach (DSCR loans).",
          es: 'El enganche (espera un mínimo de 20–25% en un alquiler), el puntaje de crédito, las reservas de efectivo (a menudo 6 meses de pagos) y la renta proyectada de la propia propiedad, que puede contar como ingreso para calificar mediante el enfoque de cobertura del servicio de la deuda (préstamos DSCR).',
        },
      ] },
      { heading: { en: 'Fixed vs adjustable', es: 'Fija vs ajustable' }, body: [
        {
          en: 'In a higher-rate environment, some investors use adjustable or interest-only structures to keep early cashflow positive, betting on refinancing later. That is a real strategy and a real risk — if rates do not fall, the reset hurts. Do not assume a refinance you cannot guarantee.',
          es: 'En un entorno de tasas altas, algunos inversionistas usan estructuras ajustables o de solo interés para mantener el flujo de efectivo positivo al inicio, apostando a refinanciar después. Esa es una estrategia real y un riesgo real — si las tasas no bajan, el reajuste duele. No asumas una refinanciación que no puedes garantizar.',
        },
      ] },
      { heading: { en: 'DSCR loans in plain English', es: 'Préstamos DSCR en palabras simples' }, body: [
        {
          en: 'A DSCR (debt-service coverage ratio) loan qualifies the property instead of you: the lender divides projected rent by the proposed payment. A ratio of 1.25 means the rent covers the payment with 25% to spare — most DSCR lenders want 1.0–1.25 minimum. No tax returns, no W-2s, which is why self-employed investors and people with several mortgages already on file use them.',
          es: 'Un préstamo DSCR (relación de cobertura del servicio de la deuda) califica a la propiedad en lugar de a ti: el prestamista divide la renta proyectada entre el pago propuesto. Una relación de 1.25 significa que la renta cubre el pago con un 25% de sobra — la mayoría de los prestamistas DSCR piden un mínimo de 1.0–1.25. Sin declaraciones de impuestos, sin comprobantes de nómina, y por eso los inversionistas independientes y quienes ya tienen varias hipotecas los usan.',
        },
        {
          en: 'The trade: DSCR rates run another 0.25–1 point above conventional investment rates, and prepayment penalties are common. They are a tool for scaling a portfolio, not for squeezing out the cheapest possible payment on your first rental.',
          es: 'El intercambio: las tasas DSCR corren otros 0.25–1 punto por encima de las tasas convencionales de inversión, y las penalizaciones por pago anticipado son comunes. Son una herramienta para escalar un portafolio, no para conseguir el pago más barato posible en tu primer alquiler.',
        },
      ] },
      { heading: { en: 'How to actually shop a rate', es: 'Cómo comparar tasas de verdad' }, body: [
        {
          en: 'Get three to five quotes on the same day — rates move daily, so Monday\'s quote vs Thursday\'s quote tells you about the market, not the lender. Compare using the loan estimate\'s line items, not the headline rate: a 6.5% rate with $6,000 in points can be worse than 6.875% with none. One discount point (1% of the loan) typically buys the rate down ~0.25%; divide the point cost by the monthly savings to get your break-even in months, and only pay points if you will hold the loan well past it.',
          es: 'Consigue de tres a cinco cotizaciones el mismo día — las tasas cambian a diario, así que la cotización del lunes contra la del jueves te habla del mercado, no del prestamista. Compara usando las partidas del estimado del préstamo, no la tasa del titular: una tasa de 6.5% con $6,000 en puntos puede ser peor que 6.875% sin puntos. Un punto de descuento (1% del préstamo) normalmente baja la tasa ~0.25%; divide el costo del punto entre el ahorro mensual para obtener tu punto de equilibrio en meses, y solo paga puntos si mantendrás el préstamo mucho más allá.',
        },
        {
          en: 'Local banks and credit unions sometimes beat the big online lenders on investment property, especially if you hold deposits there. It costs one afternoon of phone calls to find out — on a $225,000 loan, an eighth of a point is about $6,800 over ten years.',
          es: 'Los bancos locales y las cooperativas de crédito a veces superan a los grandes prestamistas en línea en propiedades de inversión, especialmente si tienes depósitos con ellos. Cuesta una tarde de llamadas averiguarlo — en un préstamo de $225,000, un octavo de punto son unos $6,800 en diez años.',
        },
      ] },
      { heading: { en: 'Refinance math: the only formula you need', es: 'Cuentas de refinanciación: la única fórmula que necesitas' }, body: [
        {
          en: 'Refinance closing costs divided by monthly savings equals break-even months. $5,000 in costs to save $180 a month breaks even in 28 months — worth it if you will hold the property for years, not worth it if you might sell. Ignore the "drop your rate by 1% rule"; the break-even period is the actual decision.',
          es: 'Los costos de cierre de la refinanciación divididos entre el ahorro mensual dan los meses de equilibrio. $5,000 en costos para ahorrar $180 al mes se recupera en 28 meses — vale la pena si mantendrás la propiedad por años, no vale la pena si podrías vender. Ignora la "regla de bajar tu tasa 1%"; el período de equilibrio es la decisión real.',
        },
      ] },
      { heading: { en: 'The honest takeaway', es: 'La conclusión honesta' }, body: [
        {
          en: 'Rates are a cost input, not a strategy. A deal that only works at a rate you cannot lock is not a deal. Underwrite at the rate you can actually get today, with a margin of safety.',
          es: 'Las tasas son un costo de entrada, no una estrategia. Un trato que solo funciona a una tasa que no puedes asegurar no es un trato. Evalúa con la tasa que realmente puedes obtener hoy, con un margen de seguridad.',
        },
      ] },
    ],
  },
  {
    slug: 'rent-prices-by-city',
    title: { en: 'Rent prices by city: where rents are rising and cooling', es: 'Precios de renta por ciudad: dónde suben y dónde se enfrían' },
    category: { en: 'Rent rates', es: 'Precios de renta' },
    excerpt: {
      en: 'National averages hide everything that matters. Rent is a local number — here is how to read your market.',
      es: 'Los promedios nacionales ocultan todo lo que importa. La renta es un número local — así se lee tu mercado.',
    },
    readMins: 9,
    updated: '2026-07-05',
    sections: [
      { body: [
        {
          en: 'There is no such thing as "the rent." Sun Belt metros that boomed are seeing flat-to-falling rents as a wave of new apartments delivers, while supply-constrained coastal and Midwest cities keep grinding higher. A national "average rent" tells you almost nothing about your block.',
          es: 'No existe "la renta". Las metrópolis del Sun Belt que tuvieron un auge están viendo rentas estables o a la baja a medida que llega una ola de apartamentos nuevos, mientras que las ciudades costeras y del Medio Oeste con poca oferta siguen subiendo. Una "renta promedio" nacional no te dice casi nada sobre tu cuadra.',
        },
      ] },
      { heading: { en: 'How to actually price a unit', es: 'Cómo fijar el precio de una unidad de verdad' }, body: [
        {
          en: 'Pull 5–10 truly comparable active and recently-rented listings within ~1 mile — same bed/bath, similar condition and amenities. Price to the comps, not to your mortgage. The market does not care what you paid.',
          es: 'Reúne 5–10 listados verdaderamente comparables, activos y recién alquilados, dentro de ~1 milla — mismas habitaciones/baños, condición y comodidades similares. Fija el precio según los comparables, no según tu hipoteca. Al mercado no le importa lo que pagaste.',
        },
        {
          en: "Watch days-on-market: if comparable units sit for weeks, you are in a renter's market and should price at or slightly below the middle of the range to avoid costly vacancy.",
          es: 'Observa los días en el mercado: si las unidades comparables permanecen semanas sin alquilarse, estás en un mercado de inquilinos y deberías fijar el precio en o ligeramente por debajo del medio del rango para evitar una vacancia costosa.',
        },
      ] },
      { heading: { en: 'Rising vs cooling — the signal', es: 'Subiendo vs enfriándose — la señal' }, body: [
        {
          en: 'New-construction permits and deliveries are the leading indicator. A metro adding a lot of new supply will see rent growth stall even if jobs are strong. A metro that builds little will see rents rise even with modest demand. Follow the cranes, not the headlines.',
          es: 'Los permisos y entregas de construcción nueva son el indicador principal. Una metrópolis que agrega mucha oferta nueva verá estancarse el crecimiento de la renta aunque el empleo sea fuerte. Una metrópolis que construye poco verá subir las rentas incluso con demanda modesta. Sigue las grúas, no los titulares.',
        },
      ] },
      { heading: { en: 'The data sources worth checking', es: 'Las fuentes de datos que vale la pena revisar' }, body: [
        {
          en: 'Free and good enough for most landlords: Zillow\'s Observed Rent Index for metro-level trends, HUD\'s Fair Market Rents for a floor-level sanity check by ZIP code, and Census building-permit data for the supply pipeline. For your actual block, nothing beats twenty minutes on the listing sites filtering to your bed/bath count within a mile — sort by "newest" and note both asking prices and how long each has sat.',
          es: 'Gratis y suficiente para la mayoría de los arrendadores: el índice de rentas observadas de Zillow para tendencias por metrópolis, las Fair Market Rents de HUD como referencia base por código postal, y los datos de permisos de construcción del Censo para la oferta futura. Para tu cuadra real, nada supera veinte minutos en los sitios de listados filtrando por tus habitaciones/baños en una milla — ordena por "más reciente" y anota tanto los precios pedidos como cuánto tiempo lleva cada uno publicado.',
        },
        {
          en: 'Asking rents are not closed rents. In a cooling market, the gap between the two widens — units close 3–7% under ask with a month free thrown in. If every comp has a concession banner, your effective market rent is lower than the listings suggest.',
          es: 'Las rentas pedidas no son las rentas cerradas. En un mercado que se enfría, la brecha entre las dos se amplía — las unidades cierran 3–7% por debajo del precio pedido con un mes gratis incluido. Si cada comparable tiene un banner de promoción, tu renta efectiva de mercado es más baja de lo que sugieren los listados.',
        },
      ] },
      { heading: { en: 'Renewal increases: the retention math', es: 'Aumentos de renovación: las cuentas de la retención' }, body: [
        {
          en: 'A turnover costs real money: cleaning and touch-up paint ($500–$1,500), listing time, showings, screening, and typically 2–6 weeks of vacancy. Call it $2,500–$4,000 all-in on a $2,000 unit. That means pushing a good tenant out with a $150 increase they will not accept loses more than the increase would earn in a year. Raise moderately (2–4%) on tenants who pay on time and treat the place well; save aggressive repricing for turnover.',
          es: 'Una rotación cuesta dinero real: limpieza y retoques de pintura ($500–$1,500), tiempo de publicación, visitas, verificación de antecedentes, y típicamente 2–6 semanas de vacancia. Digamos $2,500–$4,000 en total en una unidad de $2,000. Eso significa que expulsar a un buen inquilino con un aumento de $150 que no aceptará pierde más de lo que el aumento ganaría en un año. Sube moderadamente (2–4%) a los inquilinos que pagan a tiempo y cuidan el lugar; guarda los reajustes agresivos para la rotación.',
        },
      ] },
      { heading: { en: 'Seasonality: when to list', es: 'Estacionalidad: cuándo publicar' }, body: [
        {
          en: 'Rental demand peaks May through August — families move between school years and leases signed in past summers roll over. The same unit can rent for 2–5% more and lease two weeks faster in July than in December. If you control the lease end date, steer it toward late spring or summer with an off-cycle initial term (say, 14 months instead of 12). A December vacancy is the most expensive kind.',
          es: 'La demanda de alquiler alcanza su pico de mayo a agosto — las familias se mudan entre años escolares y los contratos firmados en veranos pasados se renuevan. La misma unidad puede alquilarse por 2–5% más y dos semanas más rápido en julio que en diciembre. Si controlas la fecha de fin del contrato, dirígela hacia fines de primavera o verano con un plazo inicial fuera de ciclo (digamos, 14 meses en lugar de 12). Una vacancia en diciembre es la más cara de todas.',
        },
      ] },
      { heading: { en: 'Real talk', es: 'Hablemos claro' }, body: [
        {
          en: 'Chasing the top of the market with an aggressive asking rent usually costs more in vacancy than it earns in rent. One empty month on a $2,000 unit is an ~8% hit to the year. Price to lease quickly to a good tenant.',
          es: 'Perseguir la cima del mercado con una renta de pedido agresiva normalmente cuesta más en vacancia de lo que gana en renta. Un mes vacío en una unidad de $2,000 es un golpe de ~8% al año. Fija el precio para alquilar rápido a un buen inquilino.',
        },
      ] },
    ],
  },
  {
    slug: 'renters-vs-landlord-insurance',
    title: { en: 'Renters insurance vs landlord insurance: who needs what', es: 'Seguro de inquilino vs seguro de arrendador: quién necesita qué' },
    category: { en: 'Insurance', es: 'Seguros' },
    excerpt: {
      en: 'They cover completely different things. Confusing them leaves someone holding a bill they did not expect.',
      es: 'Cubren cosas completamente diferentes. Confundirlos deja a alguien con una cuenta que no esperaba.',
    },
    readMins: 8,
    updated: '2026-07-05',
    sections: [
      { body: [
        {
          en: "Quick version: landlord insurance protects the building and the owner's liability. Renters insurance protects the tenant's belongings and the tenant's liability. One does not cover the other, and that gap is where disputes happen.",
          es: 'Versión rápida: el seguro del arrendador protege el edificio y la responsabilidad del dueño. El seguro del inquilino protege las pertenencias del inquilino y la responsabilidad del inquilino. Uno no cubre al otro, y esa brecha es donde ocurren las disputas.',
        },
      ] },
      { heading: { en: 'Landlord (dwelling) insurance', es: 'Seguro del arrendador (de la vivienda)' }, body: [
        {
          en: "Covers the structure, other structures, loss of rental income if the unit becomes uninhabitable after a covered event, and the owner's liability. It does not cover the tenant's furniture, electronics, or clothing — not a dollar of it.",
          es: 'Cubre la estructura, otras estructuras, la pérdida de ingresos por alquiler si la unidad se vuelve inhabitable tras un evento cubierto, y la responsabilidad del dueño. No cubre los muebles, la electrónica ni la ropa del inquilino — ni un solo dólar.',
        },
      ] },
      { heading: { en: 'Renters insurance', es: 'Seguro de inquilino' }, body: [
        {
          en: 'Covers the tenant\'s personal property (often for ~$15–25/month), liability if the tenant causes damage or injury, and additional living expenses if they are displaced. Many leases now require it — and for good reason: it prevents the "your pipe ruined my couch, you owe me" fight from landing on the landlord.',
          es: 'Cubre los bienes personales del inquilino (a menudo por ~$15–25/mes), la responsabilidad si el inquilino causa daños o lesiones, y los gastos de vivienda adicionales si es desplazado. Muchos contratos ahora lo exigen — y con razón: evita que la pelea de "tu tubería arruinó mi sofá, me debes" recaiga sobre el arrendador.',
        },
      ] },
      { heading: { en: 'What neither policy covers', es: 'Lo que ninguna póliza cubre' }, body: [
        {
          en: 'Flood and earthquake damage are excluded from both standard policies — they need separate coverage, and "the basement flooded" is one of the most common uncovered claims in the country. Also outside both: tenant-run businesses (a home daycare or workshop needs its own policy), roommates not named on the renters policy, and gradual damage like a slow leak that was ignored for months, which insurers treat as neglected maintenance rather than a covered event.',
          es: 'Los daños por inundación y terremoto están excluidos de ambas pólizas estándar — necesitan cobertura aparte, y "se inundó el sótano" es uno de los reclamos no cubiertos más comunes del país. También fuera de ambas: negocios del inquilino (una guardería o taller en casa necesita su propia póliza), compañeros de cuarto no nombrados en la póliza del inquilino, y el daño gradual como una fuga lenta ignorada por meses, que las aseguradoras tratan como mantenimiento descuidado y no como un evento cubierto.',
        },
        {
          en: 'If the property is in a flood zone, the lender will force flood insurance on the landlord — but the tenant\'s belongings in that same flood are still only covered if the tenant bought their own flood rider. Almost nobody knows this until the water is in the living room.',
          es: 'Si la propiedad está en zona de inundación, el prestamista obligará al arrendador a tener seguro contra inundaciones — pero las pertenencias del inquilino en esa misma inundación solo están cubiertas si el inquilino compró su propia cobertura contra inundaciones. Casi nadie lo sabe hasta que el agua está en la sala.',
        },
      ] },
      { heading: { en: 'How much coverage a tenant actually needs', es: 'Cuánta cobertura necesita realmente un inquilino' }, body: [
        {
          en: 'Walk through the apartment with your phone camera and add up what it would cost to replace everything — most people land between $20,000 and $40,000, far more than they guess. Choose "replacement cost" over "actual cash value": ACV pays what your five-year-old TV was worth (almost nothing); replacement cost pays for a new one. The premium difference is usually a couple of dollars a month. For liability, $100,000 is the floor and $300,000 is the standard recommendation.',
          es: 'Recorre el apartamento con la cámara del teléfono y suma lo que costaría reemplazar todo — la mayoría de la gente llega a entre $20,000 y $40,000, mucho más de lo que imagina. Elige "costo de reposición" en lugar de "valor real en efectivo": el ACV paga lo que valía tu televisor de cinco años (casi nada); el costo de reposición paga uno nuevo. La diferencia de prima suele ser un par de dólares al mes. Para responsabilidad civil, $100,000 es el piso y $300,000 es la recomendación estándar.',
        },
      ] },
      { heading: { en: 'When something goes wrong: the claim', es: 'Cuando algo sale mal: el reclamo' }, body: [
        {
          en: 'Document before you need to: move-in photos and a dated inventory make claims dramatically smoother for both sides. After an incident, photograph everything before cleanup, file promptly, and keep receipts for emergency expenses like a hotel night — additional-living-expense coverage reimburses them. Landlords: your policy has a deductible often in the $1,000–$5,000 range, so small damage is usually cheaper to fix out of pocket than to claim and risk a premium bump.',
          es: 'Documenta antes de necesitarlo: las fotos de entrada y un inventario con fecha hacen los reclamos dramáticamente más fluidos para ambas partes. Después de un incidente, fotografía todo antes de limpiar, presenta el reclamo pronto, y guarda los recibos de gastos de emergencia como una noche de hotel — la cobertura de gastos de vivienda adicionales los reembolsa. Arrendadores: tu póliza tiene un deducible a menudo de $1,000–$5,000, así que el daño pequeño suele salir más barato pagarlo de tu bolsillo que reclamarlo y arriesgar un aumento de prima.',
        },
      ] },
      { heading: { en: 'Real talk for landlords', es: 'Hablemos claro para arrendadores' }, body: [
        {
          en: 'Require proof of renters insurance in the lease and re-verify at renewal. It is cheap protection for the tenant and it dramatically reduces the odds that a kitchen fire or burst pipe turns into a claim against you.',
          es: 'Exige prueba del seguro de inquilino en el contrato y vuelve a verificarlo en la renovación. Es una protección barata para el inquilino y reduce drásticamente las probabilidades de que un incendio en la cocina o una tubería rota se convierta en un reclamo contra ti.',
        },
      ] },
    ],
  },
  {
    slug: 'utilities-who-pays-and-how-to-split',
    title: { en: 'Utilities: who pays, and how to split them fairly', es: 'Servicios: quién paga y cómo dividirlos de forma justa' },
    category: { en: 'Utilities', es: 'Servicios' },
    excerpt: {
      en: 'Get the utility setup wrong and you either eat surprise bills or scare off good tenants. Here are the clean options.',
      es: 'Si configuras mal los servicios, o te comes facturas sorpresa o ahuyentas a buenos inquilinos. Aquí están las opciones claras.',
    },
    readMins: 8,
    updated: '2026-07-05',
    sections: [
      { body: [
        {
          en: 'For a single-family rental, the standard is simple: the tenant puts every utility in their own name and pays it directly. You never see the bill, and you never argue about it. Make it a lease requirement and verify transfer at move-in.',
          es: 'Para un alquiler unifamiliar, el estándar es simple: el inquilino pone todos los servicios a su propio nombre y los paga directamente. Nunca ves la factura y nunca discutes por ella. Conviértelo en un requisito del contrato y verifica la transferencia al momento de la mudanza.',
        },
      ] },
      { heading: { en: 'When you cannot separate meters', es: 'Cuando no puedes separar los medidores' }, body: [
        {
          en: 'Multi-unit buildings with shared meters are the hard case. Three common approaches: (1) bundle a flat utility fee into rent (simple, but you eat overages), (2) RUBS — ratio utility billing, splitting the master bill by square footage or occupancy, or (3) sub-metering, which is the fairest but costs money to install.',
          es: 'Los edificios de varias unidades con medidores compartidos son el caso difícil. Tres enfoques comunes: (1) incluir una tarifa fija de servicios en la renta (simple, pero te comes los excedentes), (2) RUBS — facturación de servicios por proporción, dividiendo la factura maestra por pies cuadrados u ocupación, o (3) submedición, que es la más justa pero cuesta dinero instalar.',
        },
      ] },
      { heading: { en: 'The fairness trap', es: 'La trampa de la justicia' }, body: [
        {
          en: 'Flat fees feel easy but punish light users and reward heavy ones — and a tenant who is not paying per unit of use has no reason to conserve. If you bundle, set the fee realistically and revisit it yearly, or you will quietly lose money every hot summer.',
          es: 'Las tarifas fijas parecen fáciles pero castigan a los usuarios moderados y premian a los intensivos — y un inquilino que no paga por unidad de uso no tiene razón para ahorrar. Si la incluyes, fija la tarifa de forma realista y revísala cada año, o perderás dinero discretamente cada verano caluroso.',
        },
      ] },
      { heading: { en: 'Who pays what: the typical split', es: 'Quién paga qué: la división típica' }, body: [
        {
          en: 'The market norm in single-family rentals: tenant pays electric, gas, internet, and usually water/sewer; landlord covers nothing monthly. In small multifamily, landlords more often keep water, sewer, and trash (they are frequently on one meter and lien against the property if unpaid — a key detail: an unpaid water bill can follow the owner, not the tenant), while tenants hold electric and gas on separate meters. Lawn care and snow removal default to the landlord in multifamily and are negotiable in single-family.',
          es: 'La norma del mercado en alquileres unifamiliares: el inquilino paga electricidad, gas, internet y normalmente agua/drenaje; el arrendador no cubre nada mensual. En edificios pequeños, los arrendadores suelen quedarse con agua, drenaje y basura (frecuentemente están en un solo medidor y generan gravámenes contra la propiedad si no se pagan — un detalle clave: una factura de agua impaga puede perseguir al dueño, no al inquilino), mientras los inquilinos tienen electricidad y gas en medidores separados. El jardín y la nieve son del arrendador por defecto en multifamiliares y negociables en unifamiliares.',
        },
        {
          en: 'Whoever pays, the number should show up in the advertised price honestly. "Rent $1,800 + $200 mandatory utility fee" is $2,000 rent, and tenants comparison-shopping will treat it that way — or feel tricked when they find out.',
          es: 'Quien sea que pague, el número debe aparecer honestamente en el precio anunciado. "Renta $1,800 + $200 de cuota obligatoria de servicios" es una renta de $2,000, y los inquilinos que comparan la tratarán así — o se sentirán engañados cuando lo descubran.',
        },
      ] },
      { heading: { en: 'A worked example: RUBS on a fourplex', es: 'Un ejemplo con números: RUBS en un cuádruplex' }, body: [
        {
          en: 'Say the master water bill is $280/month across four units: two 2-bedroom units with two occupants each, two 1-bedrooms with one each. Split by occupancy, each occupant-share is $280 ÷ 6 ≈ $46.67 — the 2BRs pay $93 and the 1BRs pay $47. Split by square footage instead if usage tracks space (heating) rather than people (water). Publish the formula in the lease, attach the master bill to each month\'s charge, and the arguments mostly disappear.',
          es: 'Supón que la factura maestra de agua es $280/mes entre cuatro unidades: dos de 2 recámaras con dos ocupantes cada una, dos de 1 recámara con uno cada una. Dividido por ocupación, cada parte por ocupante es $280 ÷ 6 ≈ $46.67 — las de 2 recámaras pagan $93 y las de 1 recámara pagan $47. Divide por pies cuadrados si el consumo depende del espacio (calefacción) y no de las personas (agua). Publica la fórmula en el contrato, adjunta la factura maestra al cargo de cada mes, y las discusiones casi desaparecen.',
        },
      ] },
      { heading: { en: 'State rules and the fine print', es: 'Reglas estatales y la letra pequeña' }, body: [
        {
          en: 'Utility billing is regulated more than people expect. Several states and cities restrict or license RUBS, require disclosure of the allocation formula, cap administrative fees, or mandate that the landlord stay the customer of record on shared meters. A few prohibit charging tenants more than the actual utility cost. Check your state and city rules before switching billing methods on existing tenants — mid-lease changes generally require consent, not a notice.',
          es: 'La facturación de servicios está más regulada de lo que la gente espera. Varios estados y ciudades restringen o licencian el RUBS, exigen divulgar la fórmula de asignación, limitan las cuotas administrativas, u obligan a que el arrendador siga siendo el cliente registrado en medidores compartidos. Algunos prohíben cobrar a los inquilinos más que el costo real del servicio. Revisa las reglas de tu estado y ciudad antes de cambiar el método de facturación a inquilinos existentes — los cambios a mitad de contrato generalmente requieren consentimiento, no solo un aviso.',
        },
      ] },
      { heading: { en: 'Real talk', es: 'Hablemos claro' }, body: [
        {
          en: 'Whatever you choose, put it in writing in the lease with the exact method and who pays what. "We will figure it out" is how utility disputes become move-out disputes.',
          es: 'Sea lo que elijas, ponlo por escrito en el contrato con el método exacto y quién paga qué. "Ya lo resolveremos" es como las disputas por servicios se convierten en disputas de mudanza.',
        },
      ] },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

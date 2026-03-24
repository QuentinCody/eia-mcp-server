import type { ApiCatalog } from "@bio-mcp/shared/codemode/catalog";

export const eiaCatalog: ApiCatalog = {
    name: "EIA (Energy Information Administration)",
    baseUrl: "https://api.eia.gov",
    version: "2.0",
    auth: "required",
    endpointCount: 17,
    notes:
        "- All endpoints follow /v2/{route}/data pattern with api_key param\n" +
        "- Common params: frequency (weekly|monthly|quarterly|annual),\n" +
        "  data[]=value (which columns), start/end (date range),\n" +
        "  sort[0][column]=period, sort[0][direction]=desc,\n" +
        "  length (max rows, default 5000), offset (pagination)\n" +
        "- facets[series][] filters by series ID\n" +
        "- Bracket-notation params: pass as-is (e.g. data[]=value, facets[series][]=RWTC)\n" +
        "- Market-moving: Weekly Petroleum (Wed 10:30am ET), Weekly Nat Gas Storage (Thu 10:30am ET)\n" +
        "- STEO = Short-Term Energy Outlook (monthly forecasts)\n" +
        "- AEO = Annual Energy Outlook (long-term projections)",
    endpoints: [
        // --- Petroleum ---
        {
            method: "GET",
            path: "/v2/petroleum/pri/spt/data",
            summary:
                "Petroleum spot prices (WTI, Brent, heating oil, gasoline). Key series: RWTC (WTI), RBRTE (Brent)",
            category: "petroleum",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "daily, weekly, monthly, annual",
                },
                {
                    name: "data[]",
                    type: "string",
                    required: false,
                    description: "Data columns: value",
                    default: "value",
                },
                {
                    name: "facets[series][]",
                    type: "string",
                    required: false,
                    description: "Series filter (e.g. RWTC for WTI crude)",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date (YYYY-MM-DD)",
                },
                { name: "end", type: "string", required: false, description: "End date" },
                {
                    name: "sort[0][column]",
                    type: "string",
                    required: false,
                    description: "Sort column",
                    default: "period",
                },
                {
                    name: "sort[0][direction]",
                    type: "string",
                    required: false,
                    description: "asc or desc",
                    default: "desc",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows (max 5000)",
                    default: 5000,
                },
                {
                    name: "offset",
                    type: "number",
                    required: false,
                    description: "Pagination offset",
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/petroleum/sum/sndw/data",
            summary:
                "Weekly petroleum supply & disposition — THE market-moving report (crude stocks, refinery inputs, imports)",
            category: "petroleum",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "weekly, monthly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[series][]",
                    type: "string",
                    required: false,
                    description: "Series filter",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/petroleum/stoc/wstk/data",
            summary: "Weekly petroleum stocks/inventories by product and region",
            category: "petroleum",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "weekly, monthly",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[series][]",
                    type: "string",
                    required: false,
                    description: "Series filter",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/petroleum/move/imp/data",
            summary: "Petroleum imports by country and crude grade",
            category: "petroleum",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "monthly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/petroleum/pnp/crq/data",
            summary: "Refinery capacity and utilization rates",
            category: "petroleum",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "monthly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        // --- Natural Gas ---
        {
            method: "GET",
            path: "/v2/natural-gas/pri/sum/data",
            summary:
                "Natural gas prices (Henry Hub, citygate, industrial, residential, electric power)",
            category: "natural_gas",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "monthly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[series][]",
                    type: "string",
                    required: false,
                    description: "Series filter",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/natural-gas/stor/wkly/data",
            summary:
                "Weekly natural gas storage report — market-moving (storage injections/withdrawals vs expectations)",
            category: "natural_gas",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "weekly, monthly",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[series][]",
                    type: "string",
                    required: false,
                    description: "Series filter",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/natural-gas/prod/sum/data",
            summary: "Natural gas production by state and type",
            category: "natural_gas",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "monthly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        // --- Electricity ---
        {
            method: "GET",
            path: "/v2/electricity/rto/daily-fuel-type-data/data",
            summary:
                "Daily electricity generation by fuel type (coal, gas, nuclear, wind, solar, hydro)",
            category: "electricity",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "daily, monthly",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[fueltype][]",
                    type: "string",
                    required: false,
                    description: "Fuel type filter",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/electricity/retail-sales/data",
            summary:
                "Retail electricity sales, revenue, and average prices by state and sector",
            category: "electricity",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "monthly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[stateid][]",
                    type: "string",
                    required: false,
                    description: "State filter (e.g. CA, TX)",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/electricity/state-electricity-profiles/data",
            summary:
                "State-level electricity profiles (generation mix, capacity, emissions)",
            category: "electricity",
            queryParams: [
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[stateid][]",
                    type: "string",
                    required: false,
                    description: "State filter",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        // --- Coal ---
        {
            method: "GET",
            path: "/v2/coal/shipments/data",
            summary: "Coal shipments by origin, destination, and mine type",
            category: "coal",
            queryParams: [
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        // --- Nuclear ---
        {
            method: "GET",
            path: "/v2/nuclear-outages/us-nuclear-outages/data",
            summary: "Nuclear power plant outage reports",
            category: "nuclear",
            queryParams: [
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        // --- Total Energy ---
        {
            method: "GET",
            path: "/v2/total-energy/data",
            summary:
                "Total energy consumption and production by source (comprehensive US energy balance)",
            category: "total_energy",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "monthly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[msn][]",
                    type: "string",
                    required: false,
                    description: "Series mnemonic filter",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        // --- International ---
        {
            method: "GET",
            path: "/v2/international/data",
            summary:
                "International energy data by country (production, consumption, trade)",
            category: "international",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "monthly, quarterly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[countryRegionId][]",
                    type: "string",
                    required: false,
                    description: "Country/region filter",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        // --- Forecasts ---
        {
            method: "GET",
            path: "/v2/steo/data",
            summary:
                "Short-Term Energy Outlook: monthly forecasts of prices, supply, demand (published monthly ~8th)",
            category: "forecasts",
            queryParams: [
                {
                    name: "frequency",
                    type: "string",
                    required: false,
                    description: "monthly, quarterly, annual",
                },
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[seriesId][]",
                    type: "string",
                    required: false,
                    description: "Series filter",
                },
                {
                    name: "start",
                    type: "string",
                    required: false,
                    description: "Start date",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
        {
            method: "GET",
            path: "/v2/aeo/data",
            summary:
                "Annual Energy Outlook: long-term projections of US energy markets",
            category: "forecasts",
            queryParams: [
                { name: "data[]", type: "string", required: false, description: "value" },
                {
                    name: "facets[seriesId][]",
                    type: "string",
                    required: false,
                    description: "Series filter",
                },
                {
                    name: "length",
                    type: "number",
                    required: false,
                    description: "Max rows",
                    default: 5000,
                },
            ],
        },
    ],
};

/**
 * Country code lookup for the world map.
 *
 * world-atlas (the topojson the map renders) identifies countries by ISO 3166-1
 * *numeric* code and carries no alpha code at all, while every country figure in
 * Vigil is keyed by ISO-2. Without this table the lookup never matched, so the map
 * drew all 177 countries in the default grey no matter what the data said.
 *
 * Generated from the ISO 3166-1 code list (i18n-iso-countries) against the atlas's
 * own country list: 174 of its 177 shapes. The three left out - Kosovo, Northern
 * Cyprus and Somaliland - carry no ISO numeric code in the atlas.
 */

export const NUMERIC_TO_ISO2 = {
  '004': 'AF', // Afghanistan
  '008': 'AL', // Albania
  '012': 'DZ', // Algeria
  '024': 'AO', // Angola
  '010': 'AQ', // Antarctica
  '032': 'AR', // Argentina
  '051': 'AM', // Armenia
  '036': 'AU', // Australia
  '040': 'AT', // Austria
  '031': 'AZ', // Azerbaijan
  '044': 'BS', // Bahamas
  '050': 'BD', // Bangladesh
  112: 'BY', // Belarus
  '056': 'BE', // Belgium
  '084': 'BZ', // Belize
  204: 'BJ', // Benin
  '064': 'BT', // Bhutan
  '068': 'BO', // Bolivia
  '070': 'BA', // Bosnia and Herz.
  '072': 'BW', // Botswana
  '076': 'BR', // Brazil
  '096': 'BN', // Brunei
  100: 'BG', // Bulgaria
  854: 'BF', // Burkina Faso
  108: 'BI', // Burundi
  116: 'KH', // Cambodia
  120: 'CM', // Cameroon
  124: 'CA', // Canada
  140: 'CF', // Central African Rep.
  148: 'TD', // Chad
  152: 'CL', // Chile
  156: 'CN', // China
  170: 'CO', // Colombia
  178: 'CG', // Congo
  188: 'CR', // Costa Rica
  191: 'HR', // Croatia
  192: 'CU', // Cuba
  196: 'CY', // Cyprus
  203: 'CZ', // Czechia
  384: 'CI', // Côte d'Ivoire
  180: 'CD', // Dem. Rep. Congo
  208: 'DK', // Denmark
  262: 'DJ', // Djibouti
  214: 'DO', // Dominican Rep.
  218: 'EC', // Ecuador
  818: 'EG', // Egypt
  222: 'SV', // El Salvador
  226: 'GQ', // Eq. Guinea
  232: 'ER', // Eritrea
  233: 'EE', // Estonia
  231: 'ET', // Ethiopia
  238: 'FK', // Falkland Is.
  242: 'FJ', // Fiji
  246: 'FI', // Finland
  260: 'TF', // Fr. S. Antarctic Lands
  250: 'FR', // France
  266: 'GA', // Gabon
  270: 'GM', // Gambia
  268: 'GE', // Georgia
  276: 'DE', // Germany
  288: 'GH', // Ghana
  300: 'GR', // Greece
  304: 'GL', // Greenland
  320: 'GT', // Guatemala
  324: 'GN', // Guinea
  624: 'GW', // Guinea-Bissau
  328: 'GY', // Guyana
  332: 'HT', // Haiti
  340: 'HN', // Honduras
  348: 'HU', // Hungary
  352: 'IS', // Iceland
  356: 'IN', // India
  360: 'ID', // Indonesia
  364: 'IR', // Iran
  368: 'IQ', // Iraq
  372: 'IE', // Ireland
  376: 'IL', // Israel
  380: 'IT', // Italy
  388: 'JM', // Jamaica
  392: 'JP', // Japan
  400: 'JO', // Jordan
  398: 'KZ', // Kazakhstan
  404: 'KE', // Kenya
  414: 'KW', // Kuwait
  417: 'KG', // Kyrgyzstan
  418: 'LA', // Laos
  428: 'LV', // Latvia
  422: 'LB', // Lebanon
  426: 'LS', // Lesotho
  430: 'LR', // Liberia
  434: 'LY', // Libya
  440: 'LT', // Lithuania
  442: 'LU', // Luxembourg
  807: 'MK', // Macedonia
  450: 'MG', // Madagascar
  454: 'MW', // Malawi
  458: 'MY', // Malaysia
  466: 'ML', // Mali
  478: 'MR', // Mauritania
  484: 'MX', // Mexico
  498: 'MD', // Moldova
  496: 'MN', // Mongolia
  499: 'ME', // Montenegro
  504: 'MA', // Morocco
  508: 'MZ', // Mozambique
  104: 'MM', // Myanmar
  516: 'NA', // Namibia
  524: 'NP', // Nepal
  528: 'NL', // Netherlands
  540: 'NC', // New Caledonia
  554: 'NZ', // New Zealand
  558: 'NI', // Nicaragua
  562: 'NE', // Niger
  566: 'NG', // Nigeria
  408: 'KP', // North Korea
  578: 'NO', // Norway
  512: 'OM', // Oman
  586: 'PK', // Pakistan
  275: 'PS', // Palestine
  591: 'PA', // Panama
  598: 'PG', // Papua New Guinea
  600: 'PY', // Paraguay
  604: 'PE', // Peru
  608: 'PH', // Philippines
  616: 'PL', // Poland
  620: 'PT', // Portugal
  630: 'PR', // Puerto Rico
  634: 'QA', // Qatar
  642: 'RO', // Romania
  643: 'RU', // Russia
  646: 'RW', // Rwanda
  728: 'SS', // S. Sudan
  682: 'SA', // Saudi Arabia
  686: 'SN', // Senegal
  688: 'RS', // Serbia
  694: 'SL', // Sierra Leone
  703: 'SK', // Slovakia
  705: 'SI', // Slovenia
  '090': 'SB', // Solomon Is.
  706: 'SO', // Somalia
  710: 'ZA', // South Africa
  410: 'KR', // South Korea
  724: 'ES', // Spain
  144: 'LK', // Sri Lanka
  729: 'SD', // Sudan
  740: 'SR', // Suriname
  752: 'SE', // Sweden
  756: 'CH', // Switzerland
  760: 'SY', // Syria
  158: 'TW', // Taiwan
  762: 'TJ', // Tajikistan
  834: 'TZ', // Tanzania
  764: 'TH', // Thailand
  626: 'TL', // Timor-Leste
  768: 'TG', // Togo
  780: 'TT', // Trinidad and Tobago
  788: 'TN', // Tunisia
  792: 'TR', // Turkey
  795: 'TM', // Turkmenistan
  800: 'UG', // Uganda
  804: 'UA', // Ukraine
  784: 'AE', // United Arab Emirates
  826: 'GB', // United Kingdom
  840: 'US', // United States of America
  858: 'UY', // Uruguay
  860: 'UZ', // Uzbekistan
  548: 'VU', // Vanuatu
  862: 'VE', // Venezuela
  704: 'VN', // Vietnam
  732: 'EH', // W. Sahara
  887: 'YE', // Yemen
  894: 'ZM', // Zambia
  716: 'ZW', // Zimbabwe
  748: 'SZ', // eSwatini
}

/** Atlas geography to the ISO-2 code Vigil's data is keyed by. */
export function geoToIso2(geo) {
  if (!geo) return null
  const alpha = geo.properties?.ISO_A2 || geo.properties?.iso_a2
  if (alpha && alpha !== '-99') return alpha.toUpperCase()
  const numeric = String(geo.id ?? '').padStart(3, '0')
  return NUMERIC_TO_ISO2[numeric] || null
}

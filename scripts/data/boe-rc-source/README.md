# Bank of England rigid-central CPI weights

`rc-inflation-weights.xlsx` is the Bank of England source workbook published with
the October 2026 Bank Insights article, *Inflation in central sectors with rigid
prices*.

Source: https://www.bankofengland.co.uk/-/media/boe/files/insights/2026/rc-inflation-weights.xlsx

The exporter maps the 84 published RC groups to current CPI Level 3 classes.
Education (`10.0`) spans the two current ONS education classes and is split at
calculation time using their CPI expenditure-weight shares. Package holidays
(`09.6`) is absent from the Bank workbook and therefore receives zero RC weight.
The exporter validates that the published RC weights sum to one and fails if an
unexpected CPI class or mapping appears.

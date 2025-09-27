# luci-app-modemdata
![GitHub release (latest by date)](https://img.shields.io/github/v/release/4IceG/luci-app-modemdata?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/4IceG/luci-app-modemdata?style=flat-square)
![GitHub forks](https://img.shields.io/github/forks/4IceG/luci-app-modemdata?style=flat-square)
![GitHub All Releases](https://img.shields.io/github/downloads/4IceG/luci-app-modemdata/total)

> [!NOTE]
> <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_United_Kingdom.png" height="24"> 
LuCI JS interface for [modemdata](https://github.com/obsy/modemdata) package. In the future, it will replace luci-app-3ginfo-lite.
>
> <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_Poland.png" height="24"> Interfejs LuCI JS dla pakietu [modemdata](https://github.com/obsy/modemdata). W przyszłości zastąpi on pakiet luci-app-3ginfo-lite.

> [!IMPORTANT]
> ***Due to the layout, the package is dedicated to the luci-theme-bootstrap.***
> 
> ***Ze względu na układ pakiet dedykowany jest dla motywu luci-theme-bootstrap.***

> [!IMPORTANT]
> ***Required Packages:***
> 
> ***serial:***
> sms-tool, kmod-usb-serial-option, kmod-usb-serial
> 
> ***QMI/MBIM protocol:***
> kmod-usb-net-qmi-wwan / kmod-usb-net-cdc-mbim, uqmi
>
> ***ModemManager protocol:***
> modemmanager
>
> ***hilink (ecm):***
> wget-ssl

### Supported usb devices (serial mode):

<details>
   <summary>Pokaż | Show me</summary>

``` bash
03f0581d
# Huawei E3272/E3276
# Huawei ME906s-158
# HP lt4112 Gobi 4G Module (Huawei ME906E)
# HP lt4132 LTE/HSPA+ 4G Module (Huawei ME906s)

03f0a31d
# Huawei E3272/E3276
# Huawei ME906s-158
# HP lt4112 Gobi 4G Module (Huawei ME906E)
# HP lt4132 LTE/HSPA+ 4G Module (Huawei ME906s)

05c69026
# ASKEY WWHC050

05c69215
# Quectel EC20
# Quectel EC25

05c69625
# Yuge CLM920 NC_5

05c6f601
# MEIG SLM750-V

0e8d7126
# Fibocom FM350-GL

0e8d7127
# Fibocom FM350-GL

119968a2
# Sierra Wireless MC7710

11999071
# DW5809e Dell Wireless 5809e Gobi 4G LTE Mobile Broadband Card (EM7305)
# DW5811e Snapdragon X7 LTE (EM7455B)
# Sierra Wireless EM7455

11999091
# Sierra Wireless EM7565 (generic)

119990d3
# Sierra Wireless EM9190

12d11506
# Huawei E3272/E3276
# Huawei ME906s-158
# HP lt4112 Gobi 4G Module (Huawei ME906E)
# HP lt4132 LTE/HSPA+ 4G Module (Huawei ME906s)

12d1155e
# Huawei E3272/E3276
# Huawei ME906s-158
# HP lt4112 Gobi 4G Module (Huawei ME906E)
# HP lt4132 LTE/HSPA+ 4G Module (Huawei ME906s)

12d1156c
# Huawei E3272/E3276
# Huawei ME906s-158
# HP lt4112 Gobi 4G Module (Huawei ME906E)
# HP lt4132 LTE/HSPA+ 4G Module (Huawei ME906s)

12d115c1
# Huawei E3272/E3276
# Huawei ME906s-158
# HP lt4112 Gobi 4G Module (Huawei ME906E)
# HP lt4132 LTE/HSPA+ 4G Module (Huawei ME906s)

1435d181
# WNC D18QC
# WNC D19QA

1435d191
# WNC D18QC
# WNC D19QA

16907588
# ASKEY WWHC050

19d20167
# ZTE MF821

19d20189
# ZTE MF28D
# ZTE MF290

19d21275
# ZTE P685M
# ZTE ZM8630A

19d21432
# ZTE MF286
# ZTE MF286A

19d21485
# ZTE MF286D
# ZTE MF289F

19d21489
# ZTE MF286R

1bc71040
# Telit LM940

1bc71201
# Telit LE910-EUG

1e0e9000
# SIMCOM SIM7906
# SIMCOM SIM8200EA-M2

1e0e9001
# SIMCOM SIM7906
# SIMCOM SIM8200EA-M2

1e0e9003
# SIMCOM SIM7906
# SIMCOM SIM8200EA-M2

1e2d00b3
# Cinterion MV31-W
# Thales MV31-W
# T99W175

1e2d00b7
# Cinterion MV31-W
# Thales MV31-W
# T99W175

20202033
# BroadMobi BM806U

2c7c0125
# Quectel EC20
# Quectel EC25

2c7c0306
# Quectel EP06
# Quectel EG06
# Quectel EM06

2c7c030b
# Quectel EP06
# Quectel EG06
# Quectel EM06

2c7c0512
# Quectel EG18-EA
# Quectel EM12-G
# Quectel EM160R-GL

2c7c0620
# Quectel EG18-EA
# Quectel EM12-G
# Quectel EM160R-GL

2c7c0800
# Quectel RG500Q-EA
# Quectel RG502Q-EA
# Quectel RM500U-CNV
# Quectel RM520N-GL

2c7c0801
# Quectel RG500Q-EA
# Quectel RG502Q-EA
# Quectel RM500U-CNV
# Quectel RM520N-GL

2c7c0900
# Quectel RG500Q-EA
# Quectel RG502Q-EA
# Quectel RM500U-CNV
# Quectel RM520N-GL

2c7c6026
# Quectel EC200T-EU

2cb70007
# Fibocom L850

2cb70104
# Fibocom FM150

2cb70104
# Fibocom FM190

2cd20001
# Mikrotik R11e-LTE
# COPS

2cd20004
# Mikrotik R11e-LTE6

413c81b1
# DW5809e Dell Wireless 5809e Gobi 4G LTE Mobile Broadband Card (EM7305)
# DW5811e Snapdragon X7 LTE (EM7455B)
# Sierra Wireless EM7455

413c81b6
# DW5809e Dell Wireless 5809e Gobi 4G LTE Mobile Broadband Card (EM7305)
# DW5811e Snapdragon X7 LTE (EM7455B)
# Sierra Wireless EM7455

413c81d7
# DW5821e Snapdragon X20 LTE

8087095a
# Fibocom L860
```
</details>

### Supported pci devices (serial mode):


<details>
   <summary>Pokaż | Show me</summary>

``` bash
105be0b0
# Dell DW5930e
# Foxconn T99W175

17cb0308
# Quectel RG500Q-EA
# Quectel RG502Q-EA
# Quectel RM500U-CNV
# Quectel RM520N-GL
# Quectel RM520N-GLAP

17cb5201
# Quectel RG500Q-EA
# Quectel RG502Q-EA
# Quectel RM500U-CNV
# Quectel RM520N-GL

1eac1004
# Quectel RM520N-GLAP
```
</details>


### <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_United_Kingdom.png" height="24"> Design concept / <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_Poland.png" height="24"> Koncepcja wyglądu

> "Modem(s)" window / Okno Modem(-ów):

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/mdlast3a.png?raw=true)

<img width="1045" height="779" alt="dark" src="https://github.com/user-attachments/assets/6730506d-0103-4e0e-a63d-a6b6d4698f53" />

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/mdlast3b.png?raw=true)

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/modemdata_upd_modal.png?raw=true)

> "Diagnostics" window / Okno diagnostyki:

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/mdd1.png?raw=true)

> "Defined modems" window / Okno zdefiniowanych modem(-ów):

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/mlaswer.png?raw=true)

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/masdad.png?raw=true)

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md3d.png?raw=true)

> "Configuration" window / Okno konfiguracji pakietu:

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md4b.png?raw=true)

> "Package update and support" window / Okno aktualizacji pakietu i wsparcia:

![](https://github.com/4IceG/Personal_data/blob/master/zrzuty/modemdata/md5b.png?raw=true)

### <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_United_Kingdom.png" height="24"> Thanks to / <img src="https://raw.githubusercontent.com/4IceG/Personal_data/master/dooffy_design_icons_EU_flags_Poland.png" height="24"> Podziękowania dla
- [obsy (Cezary Jackiewicz)](https://github.com/obsy)
- [Users of the eko.one.pl forum](https://eko.one.pl/forum/viewtopic.php?id=20096)

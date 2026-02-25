#!/bin/sh

#
# (c) 2024-2026 Rafał Wabik - IceG - From eko.one.pl forum
#

TAB=$1

sed -n '/<tr class="result"/,/<\/tr>/p' /tmp/bts"$TAB"_file > /tmp/bts"$TAB".txt

if [ -f /usr/bin/iconv ]; then
	bts=$(/usr/bin/iconv -f ISO-8859-2 -t UTF-8 /tmp/bts"$TAB".txt)
	echo "$bts" > /tmp/convbts"$TAB".txt
else
	if [ -f /tmp/convbts"$TAB".txt ]; then
		bts=$(cat /tmp/convbts"$TAB".txt)
	else
		bts=$(cat /tmp/bts"$TAB".txt)
	fi
fi

mobile=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '1p')
location=$(echo "$bts" | sed -n 's/.*<td style="text-align: left;"><b>\([^<]*\)<\/b>.*/\1/p')
location=$(echo "$location" | sed 's/<br \/>/, /')
l1=" $(echo "$bts" | sed -n 's/.*<td style="text-align: left;"><b>[^<]*<\/b>, \([^<]*\)<br \/>.*/\1/p')"
l2=" $(echo "$bts" | sed -n 's/.*<td style="text-align: left;"><b>[^<]*<\/b>, [^<]*<br \/>\(.*\)<\/td>.*/\1/p')"
location="$location,$l1"
locationm="$l2"
band=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '2p')
duplex=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '3p')
lac_tac=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '4p')
cid=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '5p')
rnc_enbi=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '6p')
uc_id_ecid=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '7p')
station_id=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '8p')
notes_date=$(echo "$bts" | sed -n 's/.*<td>\([^<]*\)<\/td>.*/\1/p' | sed -n '9p')


cat << EOF
{
  "mobile":"$mobile",
  "location":"$location",
  "locationmax":"$locationm",
  "band":"$band",
  "duplex":"$duplex",
  "lac_tac":"$lac_tac",
  "cid":"$cid",
  "rnc_enbi":"$rnc_enbi",
  "uc_id_ecid":"$uc_id_ecid",
  "stationid":"$station_id",
  "notes_update_date":"$notes_date"
}
EOF

exit 0

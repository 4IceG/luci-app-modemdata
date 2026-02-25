#
# Copyright 2025-2026 Rafał Wabik - IceG - From eko.one.pl forum
#
# MIT License.
#

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-modemdata
PKG_VERSION:=1.0.27
PKG_RELEASE:=20260225
LUCI_TITLE:=LuCI JS Support for modemdata application
MAINTAINER:=Rafał Wabik <4Rafal@gmail.com>
LUCI_DESCRIPTION:=Detailed information about the cellular modem and parameters of the mobile internet connection.
LUCI_DEPENDS:=+sms-tool +comgt +@BUSYBOX_DEFAULT_AWK +modemdata
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature

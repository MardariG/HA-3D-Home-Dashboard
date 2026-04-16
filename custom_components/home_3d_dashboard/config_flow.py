"""Config flow for 3D Home Dashboard."""
import os
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback

DOMAIN = "home_3d_dashboard"


class HomeDashboard3DConfigFlow(
    config_entries.ConfigFlow, domain=DOMAIN
):
    """Config flow for 3D Home Dashboard."""

    VERSION = 1

    async def async_step_user(self, user_input=None):
        """Handle the initial step."""
        if user_input is not None:
            await self.async_set_unique_id(DOMAIN)
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title="3D Home Dashboard",
                data={},
            )
        return self.async_show_form(
            step_id="user",
            description_placeholders={},
        )

    @staticmethod
    @callback
    def async_get_options_flow(entry):
        """Options flow handler."""
        return OptionsFlow(entry)


class OptionsFlow(config_entries.OptionsFlow):
    """Options flow for 3D Home Dashboard."""

    def __init__(self, entry):
        self._entry = entry

    async def async_step_init(self, user_input=None):
        """Manage options."""
        if user_input is not None:
            return self.async_create_entry(
                title="", data=user_input
            )
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({}),
            description_placeholders={
                "info": (
                    "Upload your 3D model (.glb/.gltf) "
                    "from the 3D Dashboard panel "
                    "in the sidebar."
                )
            },
        )

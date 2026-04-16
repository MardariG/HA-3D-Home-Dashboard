"""Config flow for 3D Home Dashboard."""
from homeassistant import config_entries

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
                title="3D Home Dashboard", data={}
            )
        return self.async_show_form(step_id="user")

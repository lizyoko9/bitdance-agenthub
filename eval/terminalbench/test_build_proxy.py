import unittest
from unittest.mock import patch

import yaml

from build_proxy import BuildProxyDockerEnvironment, validate_build_proxy


class BuildProxyTests(unittest.TestCase):
    def test_accepts_existing_lima_route_without_credentials(self):
        self.assertEqual(validate_build_proxy("http://192.168.5.2:7890/"), "http://192.168.5.2:7890")

    def test_rejects_credentials_and_non_proxy_destinations(self):
        for value in ("", "socks5://192.168.5.2:7890", "http://user:secret@192.168.5.2:7890",
                      "http://192.168.5.2/path", "http://192.168.5.2:7890?token=x"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                validate_build_proxy(value)

    def test_overlay_changes_only_build_arguments_not_runtime_environment(self):
        config = yaml.safe_load(BuildProxyDockerEnvironment._DOCKER_COMPOSE_BUILD_PATH.read_text())
        service = config["services"]["main"]
        self.assertNotIn("environment", service)
        self.assertNotIn("network_mode", service)
        self.assertEqual(set(service["build"]), {"context", "args"})
        self.assertEqual(set(service["build"]["args"]),
                         {"HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy", "NO_PROXY", "no_proxy"})

    def test_requires_explicit_proxy_before_initializing_environment(self):
        with patch.dict("os.environ", {}, clear=True), self.assertRaises(ValueError):
            BuildProxyDockerEnvironment()


if __name__ == "__main__":
    unittest.main()

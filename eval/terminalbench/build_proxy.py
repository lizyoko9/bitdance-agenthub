import os
from pathlib import Path
from urllib.parse import urlsplit

from harbor.environments.docker.docker import DockerEnvironment


def validate_build_proxy(value: str) -> str:
    parsed = urlsplit(value)
    if (parsed.scheme not in {"http", "https"} or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or parsed.path not in {"", "/"} or parsed.query or parsed.fragment):
        raise ValueError("AGENTHUB_BUILD_PROXY must be an HTTP(S) proxy URL without credentials, path, query, or fragment")
    if parsed.port is None:
        raise ValueError("AGENTHUB_BUILD_PROXY must declare its port")
    return value.rstrip("/")


class BuildProxyDockerEnvironment(DockerEnvironment):
    # The same build-only template applies when Harbor creates the separate verifier.
    _DOCKER_COMPOSE_BUILD_PATH = Path(__file__).with_name("docker-build-proxy.yaml")

    def __init__(self, *args, **kwargs):
        validate_build_proxy(os.environ.get("AGENTHUB_BUILD_PROXY", ""))
        super().__init__(*args, **kwargs)

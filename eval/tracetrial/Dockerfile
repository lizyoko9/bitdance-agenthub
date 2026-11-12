FROM oven/bun:1.2.15-debian@sha256:fdc3d9dd3cfc15ed5097316e5e304a3c694677015c536456358d1320a8733b6d
COPY runtime.tar.gz /tmp/agenthub-runtime.tar.gz
COPY install-runtime.sh /tmp/install-runtime.sh
RUN sh /tmp/install-runtime.sh /tmp/agenthub-runtime.tar.gz /installed-agent/agenthub && rm /tmp/agenthub-runtime.tar.gz
COPY recorder /opt/recorder
COPY container_worker.py /opt/agenthub-eval/container_worker.py
ENV PATH="/installed-agent/node/bin:${PATH}" PYTHONPATH=/opt/recorder
ARG ACTOR_UID=501
ARG ACTOR_GID=20
RUN chmod a+rx /installed-agent && mkdir -p /state/home && chown -R ${ACTOR_UID}:${ACTOR_GID} /state
USER ${ACTOR_UID}:${ACTOR_GID}
WORKDIR /installed-agent/agenthub
RUN node --import tsx --input-type=module -e 'const m=await import("./eval/tracetrial/run-agenthub.ts"); if(typeof m.runTraceTrial!=="function") throw Error("TraceTrial entry missing")'
RUN node --import tsx --input-type=module -e 'const fs=await import("node:fs"); const d=fs.mkdtempSync("/state/probe-"); try {const {createIsolatedProfile}=await import("./eval/terminalbench/profile.ts"); const p=await createIsolatedProfile({outputDir:d,group:"single",modelId:"gpt-6-luna"},()=>{},{benchmark:"tracetrial"}); p.close();} finally {fs.rmSync(d,{recursive:true,force:true});}'
CMD ["sleep", "infinity"]

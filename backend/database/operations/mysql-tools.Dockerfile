FROM oraclelinux:9-slim

RUN microdnf module enable mysql:8.4 \
  && microdnf install -y mysql \
  && microdnf clean all

ENTRYPOINT ["mysqlbinlog"]

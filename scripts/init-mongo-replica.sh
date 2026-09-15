#!/usr/bin/env bash
set -euo pipefail

mongo_host="${MONGO_HOST:-mongo}"
mongo_port="${MONGO_PORT:-27017}"
advertised_host="${MONGO_ADVERTISED_HOST:-localhost}"
replica_set="${MONGO_REPLICA_SET:-rs0}"
mongo_uri="mongodb://${mongo_host}:${mongo_port}/admin"

echo "Waiting for MongoDB at ${mongo_host}:${mongo_port}..."
until mongosh "${mongo_uri}" --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; do
  sleep 2
done

mongosh "${mongo_uri}" --quiet --eval "
  try {
    const status = rs.status();
    if (status.set !== '${replica_set}') {
      throw new Error('MongoDB belongs to an unexpected replica set: ' + status.set);
    }
    print('Replica set ${replica_set} is already initialized.');
  } catch (error) {
    if (error.codeName !== 'NotYetInitialized' && error.code !== 94) {
      throw error;
    }
    rs.initiate({
      _id: '${replica_set}',
      members: [{ _id: 0, host: '${advertised_host}:${mongo_port}' }]
    });
    print('Replica set ${replica_set} initialization requested.');
  }
"

echo "Waiting for replica set ${replica_set} to elect a primary..."
until mongosh "${mongo_uri}?directConnection=true" --quiet --eval "db.hello().isWritablePrimary" | grep -q true; do
  sleep 2
done

echo "Replica set ${replica_set} is ready."

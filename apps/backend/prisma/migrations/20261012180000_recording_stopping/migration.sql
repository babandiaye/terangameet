-- Stop requested, egress still finalizing: not deletable until egress_ended.
ALTER TYPE "RecordingStatus" ADD VALUE 'STOPPING' AFTER 'ACTIVE';

"""worker attestation columns

Revision ID: f8a1e3d2b491
Revises: e96f1b1c3597
Create Date: 2026-07-02 09:00:00.000000

Adds columns needed to seal worker-bound traffic:
* pubkey_x25519 — base64 of the worker's long-lived X25519 identity
* trust_level   — none / self_signed / hardware (Phase 1 stops at self_signed)
* attested_at   — last time we verified the identity via challenge-response
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f8a1e3d2b491'
down_revision: Union[str, Sequence[str], None] = 'e96f1b1c3597'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'workers',
        sa.Column('pubkey_x25519', sa.String(length=64), nullable=True),
    )
    op.add_column(
        'workers',
        sa.Column(
            'trust_level',
            sa.String(length=16),
            nullable=False,
            server_default='none',
        ),
    )
    op.add_column(
        'workers',
        sa.Column('attested_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('workers', 'attested_at')
    op.drop_column('workers', 'trust_level')
    op.drop_column('workers', 'pubkey_x25519')

"""onchain settlement: wallets + settlement_txs ledger

Revision ID: c3d9a4e8b2f6
Revises: f8a1e3d2b491
Create Date: 2026-07-06 10:00:00.000000

* users.wallet_address      — consumer's USDC escrow wallet (optional rail)
* suppliers.payout_wallet   — supplier's USDC earnings wallet
* settlement_txs            — public mirror of every ClawEscrow call
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d9a4e8b2f6'
down_revision: Union[str, Sequence[str], None] = 'f8a1e3d2b491'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('wallet_address', sa.String(length=42), nullable=True))
    op.add_column('suppliers', sa.Column('payout_wallet', sa.String(length=42), nullable=True))
    op.create_table(
        'settlement_txs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('booking_id', sa.String(length=36), nullable=False),
        sa.Column('kind', sa.String(length=12), nullable=False),
        sa.Column('status', sa.String(length=12), nullable=False),
        sa.Column('tx_hash', sa.String(length=66), nullable=True),
        sa.Column('block_number', sa.BigInteger(), nullable=True),
        sa.Column('consumer_wallet', sa.String(length=42), nullable=True),
        sa.Column('supplier_wallet', sa.String(length=42), nullable=True),
        sa.Column('rate_per_hour_cents', sa.Integer(), nullable=True),
        sa.Column('usage_seconds', sa.Integer(), nullable=True),
        sa.Column('amount_usdc', sa.BigInteger(), nullable=True),
        sa.Column('commission_usdc', sa.BigInteger(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_settlement_txs_booking_id'), 'settlement_txs', ['booking_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_settlement_txs_booking_id'), table_name='settlement_txs')
    op.drop_table('settlement_txs')
    op.drop_column('suppliers', 'payout_wallet')
    op.drop_column('users', 'wallet_address')
